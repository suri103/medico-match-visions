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
-- MedicoMatch Supabase Migration: 004_plans_quotas_and_billing.sql
-- Description: Membership Plans, Quotas, Subscriptions, and Payment Records
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE plan_tier_enum AS ENUM ('free', 'gold', 'platinum');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status_enum AS ENUM ('active', 'past_due', 'cancelled', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 1. MEMBERSHIP PLANS DEFINITION TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier plan_tier_enum NOT NULL UNIQUE,
    price_inr INT NOT NULL,
    duration_months INT DEFAULT 1,
    monthly_interests_limit INT NOT NULL,
    video_dates_limit INT NOT NULL,
    contact_views_limit INT NOT NULL,
    can_send_custom_messages BOOLEAN DEFAULT FALSE,
    can_use_advanced_filters BOOLEAN DEFAULT FALSE,
    can_access_verified_contacts BOOLEAN DEFAULT FALSE,
    features_list TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Plan Configurations
INSERT INTO public.membership_plans (
    id, name, tier, price_inr, duration_months,
    monthly_interests_limit, video_dates_limit, contact_views_limit,
    can_send_custom_messages, can_use_advanced_filters, can_access_verified_contacts,
    features_list
) VALUES 
(
    'plan_free', 'Basic Doctor Member', 'free', 0, 120,
    5, 0, 0,
    FALSE, FALSE, FALSE,
    '{"5 Monthly Matrimonial Interests", "Browse Verified Doctor Profiles", "Prebuilt Conversation Starters", "Kundali Milan Compatibility Score"}'
),
(
    'plan_gold', 'Gold Doctor Tier', 'gold', 2499, 3,
    25, 3, 15,
    TRUE, TRUE, TRUE,
    '{"25 Monthly Matrimonial Interests", "3 Virtual Video Dates", "15 Direct Verified Contacts", "Personalized Custom Messaging", "Advanced Specialty & Subcaste Filters"}'
),
(
    'plan_platinum', 'Platinum VIP Doctor Tier', 'platinum', 4999, 6,
    75, 10, 50,
    TRUE, TRUE, TRUE,
    '{"Unlimited Priority Matrimonial Interests", "10 High-Definition Video Dates", "50 Verified Direct Contacts", "Unrestricted VIP Custom Messaging", "Top Profile Placement in Doctor Searches", "Dedicated Relationship Manager"}'
)
ON CONFLICT (id) DO UPDATE SET
    price_inr = EXCLUDED.price_inr,
    monthly_interests_limit = EXCLUDED.monthly_interests_limit,
    video_dates_limit = EXCLUDED.video_dates_limit,
    contact_views_limit = EXCLUDED.contact_views_limit,
    features_list = EXCLUDED.features_list;

-- -----------------------------------------------------------------------------
-- 2. USER SUBSCRIPTIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.membership_plans(id),
    status subscription_status_enum DEFAULT 'active',
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- -----------------------------------------------------------------------------
-- 3. USER QUOTAS & USAGE TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_tier plan_tier_enum DEFAULT 'free',
    
    -- Interests Quota
    interests_total INT DEFAULT 5,
    interests_used INT DEFAULT 0,
    
    -- Video Dates Quota
    video_dates_total INT DEFAULT 0,
    video_dates_used INT DEFAULT 0,
    
    -- Direct Phone/Email Contact Views Quota
    contacts_total INT DEFAULT 0,
    contacts_used INT DEFAULT 0,
    
    -- Custom Messaging Permission
    can_compose_custom_messages BOOLEAN DEFAULT FALSE,
    
    quota_resets_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON public.user_quotas(user_id);

-- -----------------------------------------------------------------------------
-- 4. PAYMENT TRANSACTIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_inr INT NOT NULL,
    plan_id TEXT REFERENCES public.membership_plans(id),
    razorpay_payment_intent_id TEXT,
    status TEXT DEFAULT 'succeeded',
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON public.payment_transactions(user_id);
