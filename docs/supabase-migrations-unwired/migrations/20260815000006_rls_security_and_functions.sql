-- ===========================================================================
-- ⛔ ARCHIVED — DO NOT RUN THIS FILE AGAINST A DATABASE.
--
-- This migration set is NOT wired to the application. The live schema is
-- server/migrations/schema.sql, applied at boot by migrate() in
-- server/src/db.mjs behind a Postgres advisory lock.
--
-- Applying this file would create a parallel schema (different table names,
-- enum types and column shapes), and its RLS policies + SECURITY DEFINER
-- RPC would expose the tables to direct authenticated access and bypass every
-- quota check in server/src/domain.mjs.
--
-- The guard below aborts the transaction immediately. Removing it is a
-- deliberate, reviewed act. See ../README.md.
-- ===========================================================================
DO $$
BEGIN
  RAISE EXCEPTION 'MedicoMatch: this migration file is ARCHIVED and must not be applied. The live schema is server/migrations/schema.sql.';
END
$$;

-- =============================================================================
-- MedicoMatch Supabase Migration: 006_rls_security_and_functions.sql
-- Description: Row Level Security Policies, Auto-provisioning Triggers & RPCs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Get the public profile ID for the current authenticated user
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2. AUTO-PROVISION PROFILE & QUOTAS ON NEW USER SIGNUP
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    new_profile_id UUID;
    user_full_name TEXT;
BEGIN
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        'Dr. ' || split_part(NEW.email, '@', 1)
    );

    -- 1. Create Core Profile
    INSERT INTO public.profiles (
        user_id,
        email,
        full_name,
        phone,
        degree,
        specialty,
        is_verified,
        verification_status
    ) VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        NEW.raw_user_meta_data->>'phone',
        COALESCE(NEW.raw_user_meta_data->>'degree', 'MBBS'),
        COALESCE(NEW.raw_user_meta_data->>'specialty', 'General Medicine'),
        FALSE,
        'unverified'
    ) RETURNING id INTO new_profile_id;

    -- 2. Create Default Free User Quota
    INSERT INTO public.user_quotas (
        user_id,
        plan_tier,
        interests_total,
        interests_used,
        video_dates_total,
        video_dates_used,
        contacts_total,
        contacts_used,
        can_compose_custom_messages
    ) VALUES (
        new_profile_id,
        'free',
        5,
        0,
        0,
        0,
        0,
        0,
        FALSE
    );

    -- 3. Create Default Kundali Record
    INSERT INTO public.kundali_profiles (
        profile_id,
        religion,
        mother_tongue,
        manglik_status
    ) VALUES (
        new_profile_id,
        'Hindu',
        'Hindi',
        'Non-Manglik'
    );

    -- 4. Create Default Lifestyle Record
    INSERT INTO public.lifestyle_profiles (
        profile_id,
        dietary_habits,
        drinking_habits,
        smoking_habits
    ) VALUES (
        new_profile_id,
        'Vegetarian',
        'Non-Drinker',
        'Non-Smoker'
    );

    -- 5. Create Default Partner Preferences
    INSERT INTO public.partner_preferences (
        profile_id,
        age_min,
        age_max
    ) VALUES (
        new_profile_id,
        24,
        36
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_interests_updated_at ON public.interests;
CREATE TRIGGER set_interests_updated_at BEFORE UPDATE ON public.interests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_video_dates_updated_at ON public.video_dates;
CREATE TRIGGER set_video_dates_updated_at BEFORE UPDATE ON public.video_dates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kundali_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifestyle_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles are viewable by all authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        profile_visibility = 'public' 
        OR (profile_visibility = 'verified_only' AND (SELECT is_verified FROM public.profiles WHERE user_id = auth.uid()))
        OR user_id = auth.uid()
    );

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (user_id = auth.uid());

-- 2. Profile Photos Policies
CREATE POLICY "Profile photos are viewable by authenticated users"
    ON public.profile_photos FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Users can manage their own profile photos"
    ON public.profile_photos FOR ALL
    USING (profile_id = public.current_profile_id());

-- 3. Kundali & Lifestyle & Preferences Policies
CREATE POLICY "Astro and lifestyle are viewable by authenticated users"
    ON public.kundali_profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Users can manage their own kundali"
    ON public.kundali_profiles FOR ALL USING (profile_id = public.current_profile_id());

CREATE POLICY "Lifestyle profiles are viewable by authenticated users"
    ON public.lifestyle_profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Users can manage their own lifestyle"
    ON public.lifestyle_profiles FOR ALL USING (profile_id = public.current_profile_id());

CREATE POLICY "Users can view and manage their own partner preferences"
    ON public.partner_preferences FOR ALL USING (profile_id = public.current_profile_id());

-- 4. Favorites & Shortlists Policies
CREATE POLICY "Users can view and manage their own favorites"
    ON public.favorites FOR ALL USING (user_id = public.current_profile_id());

CREATE POLICY "Users can view and manage their own shortlists"
    ON public.shortlists FOR ALL USING (user_id = public.current_profile_id());

-- 5. Interests / Proposals Policies
CREATE POLICY "Users can view interests sent or received by them"
    ON public.interests FOR SELECT
    USING (sender_id = public.current_profile_id() OR receiver_id = public.current_profile_id());

CREATE POLICY "Users can send interests"
    ON public.interests FOR INSERT
    WITH CHECK (sender_id = public.current_profile_id());

CREATE POLICY "Participants can update their interests"
    ON public.interests FOR UPDATE
    USING (sender_id = public.current_profile_id() OR receiver_id = public.current_profile_id());

-- 6. Conversations & Messages Policies
CREATE POLICY "Users can view conversations they participate in"
    ON public.conversations FOR SELECT
    USING (participant_one_id = public.current_profile_id() OR participant_two_id = public.current_profile_id());

CREATE POLICY "Users can view messages in their conversations"
    ON public.messages FOR SELECT
    USING (sender_id = public.current_profile_id() OR receiver_id = public.current_profile_id());

CREATE POLICY "Users can send messages to their conversations"
    ON public.messages FOR INSERT
    WITH CHECK (sender_id = public.current_profile_id());

-- 7. Video Dates Policies
CREATE POLICY "Users can view their own video dates"
    ON public.video_dates FOR SELECT
    USING (sender_id = public.current_profile_id() OR receiver_id = public.current_profile_id());

CREATE POLICY "Users can request video dates"
    ON public.video_dates FOR INSERT
    WITH CHECK (sender_id = public.current_profile_id());

CREATE POLICY "Participants can update video dates"
    ON public.video_dates FOR UPDATE
    USING (sender_id = public.current_profile_id() OR receiver_id = public.current_profile_id());

-- 8. Reports & Blocked Policies
CREATE POLICY "Users can submit reports"
    ON public.profile_reports FOR INSERT
    WITH CHECK (reporter_id = public.current_profile_id());

CREATE POLICY "Users can view and manage their blocked doctors"
    ON public.blocked_profiles FOR ALL
    USING (user_id = public.current_profile_id());

-- 9. Quotas & Subscriptions Policies
CREATE POLICY "Users can view their own quotas"
    ON public.user_quotas FOR SELECT
    USING (user_id = public.current_profile_id());

CREATE POLICY "Users can view their own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (user_id = public.current_profile_id());

-- 10. Notifications Policies
CREATE POLICY "Users can view and manage their notifications"
    ON public.notifications FOR ALL
    USING (user_id = public.current_profile_id());

-- 11. Events Policies
CREATE POLICY "Events are viewable by all users"
    ON public.events FOR SELECT
    TO authenticated
    USING (is_active = TRUE);

CREATE POLICY "Users can manage their event registrations"
    ON public.event_registrations FOR ALL
    USING (user_id = public.current_profile_id());

-- 12. Saved Searches Policies
CREATE POLICY "Users can view and manage their saved searches"
    ON public.saved_searches FOR ALL
    USING (user_id = public.current_profile_id());

-- -----------------------------------------------------------------------------
-- 4. ATOMIC RPC FUNCTIONS (Interests & Quota Check)
-- -----------------------------------------------------------------------------

-- Send Interest RPC: Checks quota, inserts interest, creates notification, increments used quota
CREATE OR REPLACE FUNCTION public.send_matrimonial_interest(
    target_doctor_id UUID,
    starter_text TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    curr_id UUID;
    quota_rec RECORD;
    new_interest_id UUID;
BEGIN
    curr_id := public.current_profile_id();
    IF curr_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated as a doctor profile';
    END IF;

    IF curr_id = target_doctor_id THEN
        RAISE EXCEPTION 'Cannot send matrimonial interest to yourself';
    END IF;

    -- Check Block Status
    IF EXISTS (
        SELECT 1 FROM public.blocked_profiles 
        WHERE (user_id = curr_id AND blocked_doctor_id = target_doctor_id)
           OR (user_id = target_doctor_id AND blocked_doctor_id = curr_id)
    ) THEN
        RAISE EXCEPTION 'Cannot interact with this profile due to privacy/block settings';
    END IF;

    -- Check if already sent
    IF EXISTS (SELECT 1 FROM public.interests WHERE sender_id = curr_id AND receiver_id = target_doctor_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Interest already sent to this doctor');
    END IF;

    -- Check Quotas
    SELECT * INTO quota_rec FROM public.user_quotas WHERE user_id = curr_id FOR UPDATE;
    IF quota_rec.interests_used >= quota_rec.interests_total THEN
        RETURN jsonb_build_object('success', false, 'message', 'Monthly interest quota reached. Upgrade your plan for more interests.');
    END IF;

    -- Insert Interest
    INSERT INTO public.interests (
        sender_id,
        receiver_id,
        starter_note,
        status
    ) VALUES (
        curr_id,
        target_doctor_id,
        starter_text,
        'pending'
    ) RETURNING id INTO new_interest_id;

    -- Increment Quota
    UPDATE public.user_quotas 
    SET interests_used = interests_used + 1, updated_at = NOW() 
    WHERE user_id = curr_id;

    -- Create Notification for Receiver
    INSERT INTO public.notifications (
        user_id,
        sender_id,
        type,
        title,
        body,
        action_url
    ) VALUES (
        target_doctor_id,
        curr_id,
        'interest_received',
        'New Matrimonial Interest Received! ❤️',
        (SELECT full_name || ' (' || specialty || ') sent you a matrimonial interest.' FROM public.profiles WHERE id = curr_id),
        '/interested-in-you'
    );

    RETURN jsonb_build_object(
        'success', true, 
        'interest_id', new_interest_id, 
        'interests_remaining', (quota_rec.interests_total - quota_rec.interests_used - 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
