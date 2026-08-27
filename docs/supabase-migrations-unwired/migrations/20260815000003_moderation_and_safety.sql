-- =============================================================================
-- MedicoMatch Supabase Migration: 003_moderation_and_safety.sql
-- Description: Trust, Safety, Doctor Reports, and Blocked Profiles
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE report_reason_enum AS ENUM (
        'unverified_credentials',
        'harassment_inappropriate',
        'inappropriate_photo_bio',
        'commercial_spam_scam',
        'fake_identity_impersonation',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE report_status_enum AS ENUM (
        'pending_review',
        'under_investigation',
        'action_taken',
        'dismissed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 1. PROFILE REPORTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason report_reason_enum NOT NULL,
    details TEXT,
    status report_status_enum DEFAULT 'pending_review',
    admin_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_self_report CHECK (reporter_id <> reported_doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.profile_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.profile_reports(reported_doctor_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.profile_reports(status);

-- -----------------------------------------------------------------------------
-- 2. BLOCKED DOCTORS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_blocked_doctor UNIQUE (user_id, blocked_doctor_id),
    CONSTRAINT check_self_block CHECK (user_id <> blocked_doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_profiles_user ON public.blocked_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_profiles_blocked ON public.blocked_profiles(blocked_doctor_id);

-- -----------------------------------------------------------------------------
-- 3. MODERATION & SAFETY AUDIT LOGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.safety_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_logs_actor ON public.safety_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_safety_logs_action ON public.safety_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_safety_logs_created_at ON public.safety_audit_logs(created_at DESC);
