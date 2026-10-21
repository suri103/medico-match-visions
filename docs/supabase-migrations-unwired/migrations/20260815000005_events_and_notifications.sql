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
-- MedicoMatch Supabase Migration: 005_events_and_notifications.sql
-- Description: Doctor Events, Meetups, Saved Searches, and In-App Notifications
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE event_type_enum AS ENUM ('virtual_meet', 'speed_dating', 'city_mixer', 'medical_conference_meet');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type_enum AS ENUM (
        'interest_received',
        'interest_accepted',
        'interest_declined',
        'message_received',
        'video_invite_received',
        'video_invite_accepted',
        'profile_viewed',
        'profile_verified',
        'plan_upgraded',
        'system_alert'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 1. DOCTOR EVENTS & SPEED DATING MIXERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_type event_type_enum DEFAULT 'virtual_meet',
    specialty_focus TEXT DEFAULT 'All Medical Specialties',
    city TEXT DEFAULT 'Online (All India)',
    venue_address TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    max_participants INT DEFAULT 50,
    current_attendees_count INT DEFAULT 0,
    banner_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_scheduled_at ON public.events(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_events_city ON public.events(city);

-- -----------------------------------------------------------------------------
-- 2. EVENT REGISTRATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'attended', 'cancelled')),
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_event_registration UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_reg_event ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_user ON public.event_registrations(user_id);

-- -----------------------------------------------------------------------------
-- 3. IN-APP NOTIFICATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type notification_type_enum NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. SAVED SEARCH CRITERIA TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    search_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);
