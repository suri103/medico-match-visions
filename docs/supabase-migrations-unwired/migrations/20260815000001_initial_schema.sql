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
-- MedicoMatch Supabase Migration: 001_initial_schema.sql
-- Description: Core Doctor Profiles, Credentials, Photos, Kundali & Lifestyle
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom ENUM Types
DO $$ BEGIN
    CREATE TYPE verification_status_enum AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gender_enum AS ENUM ('Male', 'Female', 'Other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE marital_status_enum AS ENUM ('Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE manglik_enum AS ENUM ('Non-Manglik', 'Anshik Manglik', 'Manglik', 'Don''t Know');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 1. DOCTOR & USER PROFILES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    full_name TEXT NOT NULL,
    title TEXT DEFAULT 'Dr.',
    gender gender_enum DEFAULT 'Male',
    date_of_birth DATE,
    age INT,
    height_cm INT,
    marital_status marital_status_enum DEFAULT 'Never Married',
    
    -- Medical Credentials & Professional Details
    degree TEXT DEFAULT 'MBBS',
    specialty TEXT DEFAULT 'General Medicine',
    sub_specialty TEXT,
    hospital_name TEXT,
    clinic_address TEXT,
    city TEXT DEFAULT 'Mumbai',
    state TEXT DEFAULT 'Maharashtra',
    country TEXT DEFAULT 'India',
    
    -- Medical Council Verification
    council_name TEXT DEFAULT 'National Medical Commission (NMC) / State Council',
    registration_number TEXT,
    registration_year INT,
    verification_status verification_status_enum DEFAULT 'unverified',
    is_verified BOOLEAN DEFAULT FALSE,
    verification_document_url TEXT,
    verification_document_name TEXT,
    verified_at TIMESTAMPTZ,
    
    -- Matrimonial Bio & About
    about_me TEXT,
    family_background TEXT,
    annual_income_range TEXT,
    profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'verified_only', 'hidden')),
    
    -- Activity & Status
    is_online BOOLEAN DEFAULT FALSE,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast match filtering
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles(gender);
CREATE INDEX IF NOT EXISTS idx_profiles_specialty ON public.profiles(specialty);
CREATE INDEX IF NOT EXISTS idx_profiles_degree ON public.profiles(degree);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON public.profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_age ON public.profiles(age);
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles(is_online);

-- -----------------------------------------------------------------------------
-- 2. PROFILE PHOTOS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_photos_profile_id ON public.profile_photos(profile_id);

-- -----------------------------------------------------------------------------
-- 3. KUNDALI & ASTROLOGICAL ATTRIBUTES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kundali_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    religion TEXT DEFAULT 'Hindu',
    caste TEXT,
    subcaste TEXT,
    gotra TEXT,
    mother_tongue TEXT DEFAULT 'Hindi',
    
    -- Astro Planetary Details
    rashi TEXT,
    nakshatra TEXT,
    manglik_status manglik_enum DEFAULT 'Non-Manglik',
    birth_date DATE,
    birth_time TIME,
    birth_city TEXT,
    chart_image_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kundali_profile_id ON public.kundali_profiles(profile_id);
CREATE INDEX IF NOT EXISTS idx_kundali_religion ON public.kundali_profiles(religion);
CREATE INDEX IF NOT EXISTS idx_kundali_caste ON public.kundali_profiles(caste);
CREATE INDEX IF NOT EXISTS idx_kundali_rashi ON public.kundali_profiles(rashi);
CREATE INDEX IF NOT EXISTS idx_kundali_nakshatra ON public.kundali_profiles(nakshatra);

-- -----------------------------------------------------------------------------
-- 4. LIFESTYLE & HOBBIES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lifestyle_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    dietary_habits TEXT DEFAULT 'Vegetarian',
    drinking_habits TEXT DEFAULT 'Non-Drinker',
    smoking_habits TEXT DEFAULT 'Non-Smoker',
    fitness_routine TEXT,
    interests TEXT[] DEFAULT '{}',
    languages_spoken TEXT[] DEFAULT '{"English", "Hindi"}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lifestyle_profile_id ON public.lifestyle_profiles(profile_id);

-- -----------------------------------------------------------------------------
-- 5. PARTNER PREFERENCES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    age_min INT DEFAULT 24,
    age_max INT DEFAULT 36,
    height_min_cm INT DEFAULT 150,
    height_max_cm INT DEFAULT 195,
    marital_status_preferences TEXT[] DEFAULT '{"Never Married"}',
    specialty_preferences TEXT[] DEFAULT '{}',
    degree_preferences TEXT[] DEFAULT '{}',
    city_preferences TEXT[] DEFAULT '{}',
    state_preferences TEXT[] DEFAULT '{}',
    country_preferences TEXT[] DEFAULT '{"India"}',
    religion_preferences TEXT[] DEFAULT '{}',
    caste_preferences TEXT[] DEFAULT '{}',
    exclude_same_gotra BOOLEAN DEFAULT TRUE,
    manglik_preference TEXT DEFAULT 'Doesn''t Matter',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_preferences_profile_id ON public.partner_preferences(profile_id);
