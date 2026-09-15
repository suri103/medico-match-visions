-- ============================================================================
-- MedicoMatch schema (Postgres / Supabase) â€” wired backend, v1
-- Idempotent: safe to re-run (boot-time migration runner executes this file).
--
-- Deviations from docs/supabase-migrations-unwired (and why):
--   * No Supabase Auth: users live in `app_users`, mirrored from the Express
--     auth store. All access flows through the API with the service-role key,
--     so RLS is enabled with NO policies = deny-all for any direct anon key.
--   * Kundali/lifestyle/preferences are flattened into `profiles` (read-mostly,
--     single-writer) instead of 1:1 side tables.
--   * TEXT primary keys seeded as '1'..'17' keep existing client ids stable.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users (mirror of the Express auth store; FK target for everything)
CREATE TABLE IF NOT EXISTS app_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  specialty     TEXT NOT NULL DEFAULT '',
  degree        TEXT NOT NULL DEFAULT '',
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT,
  salt          TEXT,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles. Contact fields are NEVER returned by list/detail endpoints â€”
-- only via the quota-gated reveal endpoint.
CREATE TABLE IF NOT EXISTS profiles (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  is_sample          BOOLEAN NOT NULL DEFAULT FALSE,
  full_name          TEXT NOT NULL,
  title              TEXT NOT NULL DEFAULT 'Dr.',
  gender             TEXT CHECK (gender IN ('Male','Female','Other')),
  age                INT,
  height_cm          INT,
  marital_status     TEXT DEFAULT 'Never Married',
  degree             TEXT DEFAULT 'MBBS',
  specialty          TEXT DEFAULT 'General Medicine',
  sub_specialty      TEXT,
  hospital           TEXT,
  city               TEXT,
  state              TEXT,
  country            TEXT DEFAULT 'India',
  about_me           TEXT,
  looking_for        TEXT,
  interests          TEXT[] NOT NULL DEFAULT '{}',
  photo_url          TEXT,
  sexual_orientation TEXT DEFAULT 'Straight',
  ethnicity          TEXT,
  religion           TEXT,
  caste              TEXT,
  subcaste           TEXT,
  gotra              TEXT,
  mother_tongue      TEXT,
  rashi              TEXT,
  nakshatra          TEXT,
  manglik            TEXT DEFAULT 'Non-Manglik',
  kundali_gunas      INT,
  pref_age_min       INT DEFAULT 24,
  pref_age_max       INT DEFAULT 36,
  pref_location      TEXT,
  is_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  -- L-1 FIX: the hand-set `is_online` column was REMOVED. Presence is DERIVED
  -- from last_active_at (> NOW() - 5 min) in PROFILE_PUBLIC_COLS; a stale,
  -- write-invisible flag was misleading. Existing databases drop it below.
  profile_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (profile_visibility IN ('public','verified_only','hidden')),
  phone              TEXT,
  email              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_city       ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_specialty  ON profiles(specialty);
CREATE INDEX IF NOT EXISTS idx_profiles_verified   ON profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_visibility ON profiles(profile_visibility);
CREATE INDEX IF NOT EXISTS idx_profiles_user       ON profiles(user_id);
-- H-NEW-1: index the filter columns /api/profiles accepts via browseProfiles
-- so ILIKE + equality predicates don't fall back to seq scan when scrape
-- queries pass filter combos. city/specialty already covered above.
CREATE INDEX IF NOT EXISTS idx_profiles_religion        ON profiles(religion);
CREATE INDEX IF NOT EXISTS idx_profiles_caste          ON profiles(caste);
CREATE INDEX IF NOT EXISTS idx_profiles_mother_tongue  ON profiles(mother_tongue);
CREATE INDEX IF NOT EXISTS idx_profiles_gotra          ON profiles(gotra);
CREATE INDEX IF NOT EXISTS idx_profiles_orientation    ON profiles(sexual_orientation);
CREATE INDEX IF NOT EXISTS idx_profiles_ethnicity      ON profiles(ethnicity);
CREATE INDEX IF NOT EXISTS idx_profiles_age            ON profiles(age);
CREATE INDEX IF NOT EXISTS idx_profiles_kundali_gunas  ON profiles(kundali_gunas);
-- The browse ORDER BY boosted DESC, verified DESC, gunas DESC needs a composite
-- so a heavy filter combined with the rank scan is index-only on the order.
CREATE INDEX IF NOT EXISTS idx_profiles_browse_order
  ON profiles(profile_visibility, is_verified, kundali_gunas DESC)
  WHERE is_sample = FALSE;

-- Favorites / shortlist / blocks / reports
CREATE TABLE IF NOT EXISTS favorites (
  user_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, profile_id)
);
CREATE TABLE IF NOT EXISTS shortlists (
  user_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, profile_id)
);
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reporter_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  reported_id TEXT NOT NULL,
  reason      TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matrimonial interests. State machine: pending -> accepted|declined|withdrawn.
-- At most ONE live (pending|accepted) row per ordered pair â€” the DB, not the
-- client, is the source of truth for "already interested".
CREATE TABLE IF NOT EXISTS interests (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  note         TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interests_live_pair
  ON interests (sender_id, recipient_id)
  WHERE status IN ('pending','accepted');
CREATE INDEX IF NOT EXISTS idx_interests_recipient ON interests(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_interests_sender    ON interests(sender_id, status);

-- Chat channels exist only between MUTUAL interests (matches).
CREATE TABLE IF NOT EXISTS channels (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_a     TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  user_b     TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_a <> user_b)
);
-- Canonical uniqueness (LEAST/GREATEST) is created in the maintenance block
-- AFTER reversed pairs are normalized (existing DBs) - see bottom of file.
CREATE TABLE IF NOT EXISTS messages (
  id         BIGSERIAL PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id  TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);

-- Video dates
CREATE TABLE IF NOT EXISTS video_dates (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  requester_id     TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  other_profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_for    TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status           TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','accepted','declined','cancelled','completed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_video_dates_requester ON video_dates(requester_id, status);

-- Plans / quotas / billing. max_* = -1 means unlimited.
CREATE TABLE IF NOT EXISTS plans (
  sku             TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('membership','consultation')),
  rank            INT NOT NULL DEFAULT 0,
  max_video_dates INT NOT NULL DEFAULT 1,
  max_interests   INT NOT NULL DEFAULT 5,
  max_contacts    INT NOT NULL DEFAULT 2
);
INSERT INTO plans (sku, kind, rank, max_video_dates, max_interests, max_contacts) VALUES
  ('basic',                   'membership',   0,  1,  5, 2),
  ('premium',                 'membership',   1,  5, 30, 10),
  ('platinum',                'membership',   2, -1, -1, -1),
  ('premium-annual',          'membership',   1,  5, 30, 10),
  ('platinum-annual',         'membership',   2, -1, -1, -1),
  ('astrologer-consultation', 'consultation', 0,  0,  0, 0),
  ('kundali-report',          'consultation', 0,  0,  0, 0)
ON CONFLICT (sku) DO UPDATE SET
  kind = EXCLUDED.kind, rank = EXCLUDED.rank,
  max_video_dates = EXCLUDED.max_video_dates,
  max_interests = EXCLUDED.max_interests,
  max_contacts = EXCLUDED.max_contacts;

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id      TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  sku          TEXT NOT NULL REFERENCES plans(sku),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_id   TEXT NOT NULL DEFAULT '',
  -- Professional subscription semantics: access window + self-service cancel.
  current_period_end TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','canceling','expired','refunded')),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  -- Audit C1/H1: a separate product (e.g. a consultation booking) must coexist
  -- with a membership, so the key is (user_id, sku) - NOT user_id alone.
  PRIMARY KEY (user_id, sku)
);

CREATE TABLE IF NOT EXISTS user_quotas (
  user_id            TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  period             TEXT NOT NULL, -- 'YYYY-MM' (IST business month)
  video_dates_used   INT NOT NULL DEFAULT 0,
  interests_used     INT NOT NULL DEFAULT 0,
  contact_views_used INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period)
);

-- Billing: orders + captured payments + webhook idempotency (audit M7).
CREATE TABLE IF NOT EXISTS payment_orders (
  order_id     TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  sku          TEXT NOT NULL,
  amount_paise INT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','paid','failed')),
  simulated    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON payment_orders(user_id, created_at);

CREATE TABLE IF NOT EXISTS payment_transactions (
  payment_id   TEXT PRIMARY KEY,
  order_id     TEXT,
  user_id      TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  sku          TEXT,
  amount_paise INT NOT NULL CHECK (amount_paise >= 0),
  status       TEXT NOT NULL DEFAULT 'captured'
    CHECK (status IN ('captured','refunded')),
  source       TEXT NOT NULL DEFAULT 'webhook'
    CHECK (source IN ('webhook','verify','redeem')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook idempotency: Razorpay event ids are unique; replayed deliveries
-- must be acknowledged but applied exactly once.
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id    TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin / moderation (v2). Admins are flagged on app_users; every admin action
-- lands in admin_audit_log.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_root_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'open'
  CHECK (status IN ('open','resolved','dismissed'));
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_note TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

CREATE TABLE IF NOT EXISTS refunds (
  refund_id    TEXT PRIMARY KEY,
  payment_id   TEXT,
  order_id     TEXT,
  user_id      TEXT,
  amount_paise INT,
  reason       TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT 'webhook'
    CHECK (source IN ('webhook','admin')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  admin_id   TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL DEFAULT '',
  details    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In-app notification center (SSE pushes + durable feed).
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  data       TEXT NOT NULL DEFAULT '',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- Profile photos (primary photo + gallery). URLs may be Supabase Storage
-- public URLs or bounded data URLs when object storage isn't configured.
CREATE TABLE IF NOT EXISTS profile_photos (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_photos ON profile_photos(profile_id, display_order);

-- Contact reveal deduplication (H1/H2). A user pays quota once per viewed profile.
CREATE TABLE IF NOT EXISTS contact_views (
  viewer_id   TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (viewer_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_views_viewer ON contact_views(viewer_id);

-- Who-viewed-my-profile (matrimony trust lever). One row per viewer/profile per
-- DAY so the feed shows distinct daily views without blowing up storage; the
-- owner reads aggregates, never the viewer's identity beyond what the
-- notification carries.
CREATE TABLE IF NOT EXISTS profile_views (
  viewer_id   TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (viewer_id, profile_id, viewed_on)
);
CREATE INDEX IF NOT EXISTS idx_profile_views_profile ON profile_views(profile_id, created_at DESC);

-- Durable single-use email token hashes (prevents replay across restarts/replicas).
CREATE TABLE IF NOT EXISTS used_email_tokens (
  token_hash TEXT PRIMARY KEY,
  purpose    TEXT NOT NULL,
  used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Durable GST invoices (prevents regenerating sequence numbers on retry).
CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_number  TEXT NOT NULL UNIQUE,
  user_id         TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  payment_id      TEXT,
  token_hash      TEXT UNIQUE,
  sku             TEXT NOT NULL,
  amount_paise    INT NOT NULL,
  gst_paise       INT NOT NULL,
  doctor_name     TEXT,
  gstin           TEXT,
  billing_address TEXT,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id, issued_at DESC);

-- P0-1 Phone verification OTPs
CREATE TABLE IF NOT EXISTS phone_otps (
  user_id    TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- P0-2 Doctor credential verification documents
CREATE TABLE IF NOT EXISTS verification_documents (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  doc_type    TEXT NOT NULL,
  url         TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer    TEXT,
  note        TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verification_docs_user ON verification_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_docs_status ON verification_documents(status, created_at DESC);

-- P0-5 Spotlight profile boosts
CREATE TABLE IF NOT EXISTS profile_boosts (
  user_id    TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_boosts_expires ON profile_boosts(user_id, expires_at);

-- P0-10 Coupons
CREATE TABLE IF NOT EXISTS coupons (
  code        TEXT PRIMARY KEY,
  percent_off INT NOT NULL CHECK (percent_off > 0 AND percent_off <= 100),
  max_uses    INT NOT NULL DEFAULT 100,
  used        INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO coupons (code, percent_off, max_uses, used) VALUES
  ('WELCOME10', 10, 1000, 0),
  ('DOCTOR20', 20, 500, 0)
ON CONFLICT (code) DO NOTHING;
-- M-1 FIX: per-user coupon redemption ledger. SAFE DEFAULT: WELCOME10 (and
-- any coupon with once_per_user=TRUE) is single-use per account — the old
-- global `used` counter let one user reuse it forever. Coupons with
-- once_per_user=FALSE keep the old shared-pool semantics.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS once_per_user BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  code        TEXT NOT NULL REFERENCES coupons(code) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (code, user_id)
);
-- WELCOME10/DOCTOR20 predate the flag: enforce single-use-per-user for both.
UPDATE coupons SET once_per_user = TRUE WHERE code IN ('WELCOME10', 'DOCTOR20');
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- P0-6 Events & Community Meetups
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title       TEXT NOT NULL,
  event_date  TEXT NOT NULL,
  event_time  TEXT NOT NULL,
  location    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by  TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- @seed-sample-data:start events
-- Fabricated events with no organizer (created_by NULL). Suppressed entirely
-- when SEED_SAMPLE_DATA=false — see db.mjs migrate(), which strips this block
-- and deletes already-seeded rows at boot.
INSERT INTO events (id, title, event_date, event_time, location, description) VALUES
  ('e1', 'Medical Professionals Mixer', 'May 15', '7:00 PM', 'Boston, MA', 'Join us for an evening of networking with fellow medical professionals. Refreshments and dinner will be served.'),
  ('e2', 'Healthcare Innovation Summit & Gala', 'May 28', '9:00 AM', 'New York, NY', 'A full-day summit focusing on the latest innovations in healthcare technology, clinical trials, and practice management.'),
  ('e3', 'Wellness & Mindfulness Retreat for Doctors', 'Jun 10', '10:00 AM', 'San Francisco, CA', 'A weekend retreat focused on mental wellbeing, burnout prevention, and social connection for healthcare practitioners.'),
  ('e4', 'Delhi Medico Evening & Networking Dinner', 'Jun 22', '6:30 PM', 'Delhi, India', 'An exclusive networking evening in New Delhi for physicians, residents, and specialists across major hospitals.')
ON CONFLICT (id) DO NOTHING;
-- @seed-sample-data:end events

-- P0-6 Success stories
CREATE TABLE IF NOT EXISTS success_stories (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  story        TEXT NOT NULL,
  photo_url    TEXT NOT NULL DEFAULT '',
  approved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stories_approved ON success_stories(approved, created_at DESC);

-- Sequential GST invoice counter in Postgres
CREATE TABLE IF NOT EXISTS invoice_sequences (
  year   INT PRIMARY KEY,
  next_n INT NOT NULL DEFAULT 1
);

-- Distributed cluster-safe rate limiting bucket table
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key   VARCHAR(160) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INT NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_buckets(window_start);

-- Backward-compatible idempotent column migrations
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS salt TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS verification_level TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS id_document_url TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS id_verified_at TIMESTAMPTZ;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS strike_count INT NOT NULL DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_notified_at TIMESTAMPTZ;

-- P0-4 family/background depth: the domain layer (PROFILE_PUBLIC_COLS,
-- UPDATABLE_PROFILE_FIELDS, browseProfiles filters) and the SPA profile editor
-- already read/write these columns, but they were never declared here — a
-- fresh DB failed any profile write/browse with `column "family_type" does not
-- exist` (verified live via tests/smoke-db-run.mjs). Additive + idempotent.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS family_type    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS family_status  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS income_band     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS diet             TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS smoking         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drinking       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS disability      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expectations    TEXT;

-- Matrimony gap-closing columns (idempotent, additive):
-- * birth_date/birth_time/birth_city power a real kundali (rashi/nakshatra
--   self-declaration alone is low-fidelity); chart_image_url holds a generated
--   horoscope chart the owner may share.
-- * last_active_at is the online-presence heartbeat; presence is a DERIVED
--   value (last_active_at > NOW() - 5 min), never hand-set.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date   DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_time   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_city   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chart_image_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active_at DESC);
-- L-1 FIX: drop the dead hand-set flag on existing databases (fresh installs
-- never create it). Idempotent.
ALTER TABLE profiles DROP COLUMN IF EXISTS is_online;
-- Engagement-digest throttle marker (one activity email per user per ~day).
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS digest_sent_at TIMESTAMPTZ;

-- P-CONTROL: per-field privacy for the income band. SAFE DEFAULT 'private' —
-- income is a sensitive field for doctors; it is omitted from public/detail
-- responses unless the owner opts into 'public' (any member) or
-- 'verified_only' (verified members only). Enforcement lives in
-- domain.rowToPublicProfile; the CHECK keeps bad values out at the DB layer.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS income_visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (income_visibility IN ('public','verified_only','private'));

-- Career-stage / student eligibility: a member may be pursuing a degree and is
-- FULLY eligible to marry, but must NEVER be auto-labelled "Dr./MBBS". This is
-- the honest self-declared stage; it is separate from document-backed
-- verification (a student can be active with zero documents and vice versa).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS career_stage    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS council_name    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE verification_documents ADD COLUMN IF NOT EXISTS registry_checked   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE verification_documents ADD COLUMN IF NOT EXISTS registry_reference TEXT;

-- Paid kundali match report: a digital product (no human astrologer) built on
-- the same Ashta Koota engine the free preview uses. Bought via the standard
-- Razorpay->redeem path; keyed by (buyer, profile) so the report is stable.
CREATE TABLE IF NOT EXISTS kundali_reports (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  buyer_id        TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id        TEXT,
  payment_id      TEXT,
  report          JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_kundali_reports_buyer ON kundali_reports(buyer_id, created_at DESC);

-- Consultations share the video-date scheduler with an explicit kind.
ALTER TABLE video_dates ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'video_date'
  CHECK (kind IN ('video_date','consultation'));
ALTER TABLE video_dates ALTER COLUMN other_profile_id DROP NOT NULL;

-- Row Level Security: deny-all. The API connects with the service-role key
-- which bypasses RLS; a leaked anon/publishable key must read NOTHING.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_users','profiles','favorites','shortlists',
    'blocks','reports','interests','channels','messages','video_dates',
    'plans','subscriptions','user_quotas','payment_orders',
    'payment_transactions','webhook_events','refunds','admin_audit_log','notifications','profile_photos',
    'contact_views','used_email_tokens','invoices','phone_otps','verification_documents',
    'profile_boosts','coupons','events','event_rsvps','success_stories','invoice_sequences','rate_limit_buckets',
    'profile_views','kundali_reports']
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Seed: browsable profiles (the former in-app "sample data", now real rows).
-- Contact fields deliberately NULL â€” nothing is fabricated.
-- ----------------------------------------------------------------------------
-- @seed-sample-data:start profiles
INSERT INTO profiles (id, is_sample, full_name, gender, age, specialty, degree,
  hospital, city, state, country, interests, photo_url, sexual_orientation,
  ethnicity, religion, caste, subcaste, gotra, mother_tongue, rashi, nakshatra,
  manglik, kundali_gunas, is_verified)
VALUES
('1', TRUE, 'John Smith', 'Male', 35, 'Cardiologist', 'MBBS, MD',
 'City General Hospital', 'New York City', 'New York', 'United States',
 ARRAY['Music','Travel','Hiking'], 'https://randomuser.me/api/portraits/men/1.jpg',
 'Straight', 'White', 'Christian', NULL, NULL, NULL, 'English',
 'Mesha (Aries)', 'Ashwini', 'Non-Manglik', 28, FALSE),
('2', TRUE, 'Emily Johnson', 'Female', 32, 'Neurologist', 'MBBS, MD',
 'Memorial Medical Center', 'Los Angeles', 'California', 'United States',
 ARRAY['Reading','Yoga','Cooking'], 'https://randomuser.me/api/portraits/women/2.jpg',
 'Bisexual', 'White', 'Christian', NULL, NULL, NULL, 'English',
 'Karka (Cancer)', 'Pushya', 'Non-Manglik', 31, FALSE),
('3', TRUE, 'David Wilson', 'Male', 40, 'Pediatrician', 'MBBS, MD',
 'Children''s Hospital', 'Chicago', 'Illinois', 'United States',
 ARRAY['Sports','Photography','Cooking'], 'https://randomuser.me/api/portraits/men/3.jpg',
 'Gay', 'White', 'Spiritual', NULL, NULL, NULL, 'English',
 'Simha (Leo)', 'Magha', 'Non-Manglik', 24, FALSE),
('4', TRUE, 'Sophia Martinez', 'Female', 28, 'Dermatologist', 'MBBS, MD',
 'Skin Care Clinic', 'Miami', 'Florida', 'United States',
 ARRAY['Fashion','Art','Dancing'], 'https://randomuser.me/api/portraits/women/4.jpg',
 'Straight', 'Hispanic', 'Christian', NULL, NULL, NULL, 'English',
 'Tula (Libra)', 'Svati', 'Non-Manglik', 27, FALSE),
('5', TRUE, 'Michael Brown', 'Male', 45, 'Orthopedic Surgeon', 'MBBS, MS',
 'University Hospital', 'Boston', 'Massachusetts', 'United States',
 ARRAY['Golf','Wine Tasting'], 'https://randomuser.me/api/portraits/men/5.jpg',
 'Straight', 'White', 'Christian', NULL, NULL, NULL, 'English',
 'Vrishabha (Taurus)', 'Rohini', 'Non-Manglik', 26, FALSE),
('6', TRUE, 'Laura Martinez', 'Female', 33, 'Radiologist', 'MBBS, MD',
 'Seattle Medical Center', 'Seattle', 'Washington', 'United States',
 ARRAY['Hiking','Coffee','Books'], 'https://randomuser.me/api/portraits/women/6.jpg',
 'Straight', 'White', 'Christian', NULL, NULL, NULL, 'English',
 'Mithuna (Gemini)', 'Ardra', 'Non-Manglik', 25, FALSE),
('7', TRUE, 'Dr. Vikram Singh', 'Male', 34, 'Pediatrics', 'MD, DM (Neonatology)',
 'Max Super Speciality Hospital', 'Delhi', 'Delhi', 'India',
 ARRAY['Cycling','Fitness','Music'], 'https://randomuser.me/api/portraits/men/7.jpg',
 'Straight', 'Asian', 'Hindu', 'Rajput', NULL, 'Vashishtha', 'Hindi',
 'Karka (Cancer)', 'Pushya', 'Non-Manglik', 28, TRUE),
('8', TRUE, 'Dr. Sneha Mukherjee', 'Female', 29, 'Gynecology', 'MS (Obstetrics & Gynecology)',
 'AMRI Hospitals', 'Kolkata', 'West Bengal', 'India',
 ARRAY['Classical Dance','Baking','Teaching'], 'https://randomuser.me/api/portraits/women/8.jpg',
 'Straight', 'Asian', 'Hindu', 'Brahmin', 'Mukherjee', 'Bharadwaj', 'Bengali',
 'Simha (Leo)', 'Purva Phalguni', 'Non-Manglik', 30, TRUE),
('9', TRUE, 'Dr. Aditya Sharma', 'Male', 31, 'Cardiology', 'MD, DM (Cardiology)',
 'Lilavati Hospital', 'Mumbai', 'Maharashtra', 'India',
 ARRAY['Cricket','Trekking','Cooking'], 'https://randomuser.me/api/portraits/men/54.jpg',
 'Straight', 'Asian', 'Hindu', 'Brahmin', 'Sharma', 'Kashyap', 'Hindi',
 'Mesha (Aries)', 'Ashwini', 'Non-Manglik', 32, TRUE),
('10', TRUE, 'Dr. Priya Patel', 'Female', 29, 'Neurology', 'MD (Neurology), MBBS',
 'Apollo Hospital', 'Delhi', 'Delhi', 'India',
 ARRAY['Painting','Yoga','Travel'], 'https://randomuser.me/api/portraits/women/67.jpg',
 'Straight', 'Asian', 'Hindu', 'Patel', NULL, 'Vishwamitra', 'Gujarati',
 'Vrishabha (Taurus)', 'Rohini', 'Non-Manglik', 29, TRUE),
('11', TRUE, 'Dr. Rajesh Gupta', 'Male', 33, 'Orthopedics', 'MS (Orthopedics), MCh',
 'Fortis Hospital', 'Bangalore', 'Karnataka', 'India',
 ARRAY['Football','Guitar','Photography'], 'https://randomuser.me/api/portraits/men/35.jpg',
 'Straight', 'Asian', 'Hindu', 'Gupta', NULL, 'Garg', 'Hindi',
 'Mithuna (Gemini)', 'Punarvasu', 'Anshik Manglik', 27, TRUE),
('12', TRUE, 'Dr. Ananya Reddy', 'Female', 28, 'Dermatology', 'MD (Dermatology), DNB',
 'KIMS Hospital', 'Hyderabad', 'Telangana', 'India',
 ARRAY['Badminton','Painting','Movies'], 'https://randomuser.me/api/portraits/women/44.jpg',
 'Straight', 'Asian', 'Hindu', 'Reddy', NULL, 'Atreya', 'Telugu',
 'Kanya (Virgo)', 'Hasta', 'Non-Manglik', 31, TRUE),
('13', TRUE, 'Dr. Siddharth Deshmukh', 'Male', 32, 'General Surgery', 'MS (General Surgery), DNB',
 'KEM Hospital', 'Pune', 'Maharashtra', 'India',
 ARRAY['Marathon Running','Reading','Chess'], 'https://randomuser.me/api/portraits/men/86.jpg',
 'Straight', 'Asian', 'Hindu', 'Maratha', 'Deshmukh', 'Jamadagni', 'Marathi',
 'Tula (Libra)', 'Svati', 'Non-Manglik', 28, TRUE),
('14', TRUE, 'Dr. Meera Iyer', 'Female', 30, 'Radiology', 'MD (Radiology), MBBS',
 'Apollo Main Hospital', 'Chennai', 'Tamil Nadu', 'India',
 ARRAY['Bharatanatyam','Cooking','Astronomy'], 'https://randomuser.me/api/portraits/women/79.jpg',
 'Straight', 'Asian', 'Hindu', 'Iyer', NULL, 'Bharadwaj', 'Tamil',
 'Karka (Cancer)', 'Ashlesha', 'Non-Manglik', 26, TRUE),
('15', TRUE, 'Dr. Rohan Deshmukh', 'Male', 33, 'Veterinary Surgery', 'BVSc & AH / MVSc',
 'State Veterinary Super Specialty Hospital', 'Nagpur', 'Maharashtra', 'India',
 ARRAY['Animal Welfare','Trekking','Wildlife Photography'], 'https://randomuser.me/api/portraits/men/52.jpg',
 'Straight', 'Asian', 'Hindu', 'Maratha', NULL, 'Jamadagni', 'Marathi',
 'Dhanu (Sagittarius)', 'Purva Ashadha', 'Non-Manglik', 30, TRUE),
('16', TRUE, 'Dr. Anjali Bhatt', 'Female', 29, 'Homeopathic Medicine', 'BHMS',
 'Hahnemann Homeopathic Care', 'Ahmedabad', 'Gujarat', 'India',
 ARRAY['Classical Music','Baking','Yoga'], 'https://randomuser.me/api/portraits/women/72.jpg',
 'Straight', 'Asian', 'Hindu', 'Brahmin', 'Bhatt', 'Shandilya', 'Gujarati',
 'Kanya (Virgo)', 'Hasta', 'Non-Manglik', 32, TRUE),
('17', TRUE, 'Nithya Menon', 'Female', 28, 'Nursing / Critical Care', 'M.Sc Nursing / NP',
 'Aster Medcity', 'Kochi', 'Kerala', 'India',
 ARRAY['Singing','Travel','Badminton'], 'https://randomuser.me/api/portraits/women/33.jpg',
 'Straight', 'Asian', 'Hindu', 'Nair', NULL, 'Vishwamitra', 'Malayalam',
 'Mithuna (Gemini)', 'Ardra', 'Non-Manglik', 27, TRUE)
ON CONFLICT (id) DO NOTHING;

UPDATE profiles SET about_me = 'Dedicated medical professional passionate about healthcare excellence and balanced living.',
  looking_for = 'Seeking a thoughtful partner who values family and mutual respect.'
WHERE about_me IS NULL AND is_sample;
-- @seed-sample-data:end profiles


-- ============================================================================
-- Maintenance block (audit fixes; idempotent on BOTH fresh and existing DBs)
-- ============================================================================

-- Audit L4: idx_subscriptions_user duplicated the PK's leading column.
DROP INDEX IF EXISTS idx_subscriptions_user;

-- Audit C1/H1 (existing DBs): subscriptions were keyed (user_id) alone. Rebuild
-- to (user_id, sku) so a consultation booking and a membership can coexist.
-- Legacy rows are one-per-user, so they remain unique under (user_id, sku).
-- NOTE: the plpgsql variable is v_conname — a variable literally named
-- `conname` collides with pg_constraint.conname and aborts the whole
-- migration transaction under plpgsql.variable_conflict=error (verified
-- against a live Postgres 18 via tests/smoke-db-run.mjs).
DO $$
DECLARE v_conname TEXT;
BEGIN
  SELECT c.conname INTO v_conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
   WHERE c.conrelid = 'subscriptions'::regclass
     AND c.contype = 'p'
     AND array_length(c.conkey, 1) = 1
     AND a.attname = 'user_id'
   LIMIT 1;
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE subscriptions DROP CONSTRAINT %I', v_conname);
    ALTER TABLE subscriptions ADD PRIMARY KEY (user_id, sku);
  END IF;
END $$;

-- Audit M5: canonical channel pairs (no self, no reversed ordering).
-- Same v_conname rename as above — see the note there.
DO $$
DECLARE v_conname TEXT;
BEGIN
  SELECT c.conname INTO v_conname FROM pg_constraint c
    WHERE c.conrelid = 'channels'::regclass AND c.contype = 'u' ORDER BY c.conname LIMIT 1;
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE channels DROP CONSTRAINT %I', v_conname);
  END IF;
  -- Merge any reversed/duplicate pairs, keeping the canonical ordering.
  DELETE FROM channels a USING channels b
   WHERE a.id <> b.id AND a.user_a > b.user_a
     AND LEAST(a.user_a, a.user_b) = LEAST(b.user_a, b.user_b)
     AND GREATEST(a.user_a, a.user_b) = GREATEST(b.user_a, b.user_b);
  UPDATE channels SET user_a = LEAST(user_a, user_b), user_b = GREATEST(user_a, user_b)
   WHERE user_a > user_b;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='channels'::regclass AND conname='channels_no_self') THEN
    ALTER TABLE channels ADD CONSTRAINT channels_no_self CHECK (user_a <> user_b);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_channels_pair
  ON channels (LEAST(user_a, user_b), GREATEST(user_a, user_b));

-- Audit M13: missing foreign keys. Orphan rows are pruned so the new
-- constraints apply cleanly to legacy data.
DO $$
BEGIN
  DELETE FROM reports
   WHERE reported_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM app_users u WHERE u.id = reports.reported_id);
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='reports'::regclass AND conname='reports_reported_id_fkey') THEN
    ALTER TABLE reports ADD CONSTRAINT reports_reported_id_fkey
      FOREIGN KEY (reported_id) REFERENCES app_users(id);
  END IF;
  DELETE FROM admin_audit_log
   WHERE admin_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM app_users u WHERE u.id = admin_audit_log.admin_id);
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='admin_audit_log'::regclass AND conname='admin_audit_log_admin_id_fkey') THEN
    ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_admin_id_fkey
      FOREIGN KEY (admin_id) REFERENCES app_users(id);
  END IF;
END $$;

-- Audit M12: money/status integrity on payment_transactions (existing DBs).
DO $$
BEGIN
  UPDATE payment_transactions SET amount_paise = 0 WHERE amount_paise IS NULL;
  ALTER TABLE payment_transactions ALTER COLUMN amount_paise SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND conname='payment_transactions_amount_check') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_amount_check CHECK (amount_paise >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND conname='payment_transactions_status_check') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_status_check CHECK (status IN ('captured','refunded'));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND conname='payment_transactions_source_check') THEN
    ALTER TABLE payment_transactions DROP CONSTRAINT payment_transactions_source_check;
  END IF;
  ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_source_check CHECK (source IN ('webhook','verify','redeem'));
END $$;

-- Audit L4: indexes for chat + video-date lookup paths.
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_video_dates_other ON video_dates(other_profile_id);

-- Audit M3: durable single-use redemption-token store. Only the SHA-256 hash
-- of the token is persisted; a leaked DB cannot replay a token.
CREATE TABLE IF NOT EXISTS redeemed_tokens (
  token_hash  TEXT PRIMARY KEY,
  sku         TEXT NOT NULL DEFAULT '',
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE redeemed_tokens ENABLE ROW LEVEL SECURITY;