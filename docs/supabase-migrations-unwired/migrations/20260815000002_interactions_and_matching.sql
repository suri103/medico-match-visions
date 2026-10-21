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
-- MedicoMatch Supabase Migration: 002_interactions_and_matching.sql
-- Description: Favorites, Shortlists, Interests, Chat, and Video Dates
-- =============================================================================

-- Custom Status ENUMs
DO $$ BEGIN
    CREATE TYPE interest_status_enum AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_type_enum AS ENUM ('text', 'prebuilt_starter', 'photo', 'video_invite');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE video_date_status_enum AS ENUM ('requested', 'accepted', 'scheduled', 'completed', 'cancelled', 'declined');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 1. FAVORITES TABLE (Star ⭐)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_doctor_favorite UNIQUE (user_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_doctor_id ON public.favorites(doctor_id);

-- -----------------------------------------------------------------------------
-- 2. SHORTLISTS TABLE (Bookmark 🔖)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shortlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_doctor_shortlist UNIQUE (user_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_shortlists_user_id ON public.shortlists(user_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_doctor_id ON public.shortlists(doctor_id);

-- -----------------------------------------------------------------------------
-- 3. MATRIMONIAL INTERESTS / PROPOSALS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status interest_status_enum DEFAULT 'pending',
    starter_note TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_sender_receiver_interest UNIQUE (sender_id, receiver_id),
    CONSTRAINT check_self_interest CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_interests_sender_id ON public.interests(sender_id);
CREATE INDEX IF NOT EXISTS idx_interests_receiver_id ON public.interests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_interests_status ON public.interests(status);

-- -----------------------------------------------------------------------------
-- 4. CONVERSATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_one_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_two_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_conversation_participants UNIQUE (participant_one_id, participant_two_id),
    CONSTRAINT check_self_conversation CHECK (participant_one_id <> participant_two_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON public.conversations(participant_one_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON public.conversations(participant_two_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- -----------------------------------------------------------------------------
-- 5. MESSAGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type message_type_enum DEFAULT 'text',
    attachment_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);

-- -----------------------------------------------------------------------------
-- 6. VIDEO DATES & VIRTUAL CALLS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status video_date_status_enum DEFAULT 'requested',
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 30,
    room_id TEXT UNIQUE DEFAULT ('mm-room-' || encode(gen_random_bytes(8), 'hex')),
    meeting_link TEXT,
    agenda_notes TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_self_video_date CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_video_dates_sender_id ON public.video_dates(sender_id);
CREATE INDEX IF NOT EXISTS idx_video_dates_receiver_id ON public.video_dates(receiver_id);
CREATE INDEX IF NOT EXISTS idx_video_dates_scheduled_at ON public.video_dates(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_video_dates_status ON public.video_dates(status);
