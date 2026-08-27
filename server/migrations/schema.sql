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
  is_online          BOOLEAN NOT NULL DEFAULT FALSE,
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
  ('astrologer-consultation', 'consultation', 0,  0,  0, 0)
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
    CHECK (source IN ('webhook','verify')),
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
    'payment_transactions','webhook_events','refunds','admin_audit_log','notifications','profile_photos']
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Seed: browsable profiles (the former in-app "sample data", now real rows).
-- Contact fields deliberately NULL â€” nothing is fabricated.
-- ----------------------------------------------------------------------------
INSERT INTO profiles (id, is_sample, full_name, gender, age, specialty, degree,
  hospital, city, state, country, interests, photo_url, sexual_orientation,
  ethnicity, religion, caste, subcaste, gotra, mother_tongue, rashi, nakshatra,
  manglik, kundali_gunas, is_verified, is_online)
VALUES
('1', TRUE, 'John Smith', 'Male', 35, 'Cardiologist', 'MBBS, MD',
 'City General Hospital', 'New York City', 'New York', 'United States',
 ARRAY['Music','Travel','Hiking'], 'https://randomuser.me/api/portraits/men/1.jpg',
 'Straight', 'White', 'Christian', NULL, NULL, NULL, 'English',
 'Mesha (Aries)', 'Ashwini', 'Non-Manglik', 28, FALSE, TRUE),
('2', TRUE, 'Emily Johnson', 'Female', 32, 'Neurologist', 'MBBS, MD',
 'Memorial Medical Center', 'Los Angeles', 'California', 'United States',
 ARRAY['Reading','Yoga','Cooking'], 'https://randomuser.me/api/portraits/women/2.jpg',
 'Bisexual', 'White', 'Christian', NULL, NULL, NULL, 'English',
 'Karka (Cancer)', 'Pushya', 'Non-Manglik', 31, FALSE, FALSE),
('3', TRUE, 'David Wilson', 'Male', 40, 'Pediatrician', 'MBBS, MD',
 'Children''s Hospital', 'Chicago', 'Illinois', 'United States',
 ARRAY['Sports','Photography','Cooking'], 'https://randomuser.me/api/portraits/men/3.jpg',
 'Gay', 'White', 'Spiritual', NULL, NULL, NULL, 'English',
 'Simha (Leo)', 'Magha', 'Non-Manglik', 24, FALSE, TRUE),
('4', TRUE, 'Sophia Martinez', 'Female', 28, 'Dermatologist', 'MBBS, MD',
 'Skin Care Clinic', 'Miami', 'Florida', 'United States',
 ARRAY['Fashion','Art','Dancing'], 'https://randomuser.me/api/portraits/women/4.jpg',
 'Straight', 'Hispanic', 'Christian', NULL, NULL, NULL, 'English',
 'Tula (Libra)', 'Svati', 'Non-Manglik', 27, FALSE, FALSE),
('5', TRUE, 'Michael Brown', 'Male', 45, 'Orthopedic Surgeon', 'MBBS, MS',
 'University Hospital', 'Boston', 'Massachusetts', 'United States',
 ARRAY['Golf','Wine Tasting'], 'https://randomuser.me/api/portraits/men/5.jpg',
 'Straight', 'White', 'Christian', NULL, NULL, NULL, 'English',
 'Vrishabha (Taurus)', 'Rohini', 'Non-Manglik', 26, FALSE, FALSE),
('6', TRUE, 'Laura Martinez', 'Female', 33, 'Radiologist', 'MBBS, MD',
 'Seattle Medical Center', 'Seattle', 'Washington', 'United States',
 ARRAY['Hiking','Coffee','Books'], 'https://randomuser.me/api/portraits/women/6.jpg',
 'Straight', 'White', 'Christian', NULL, NULL, NULL, 'English',
 'Mithuna (Gemini)', 'Ardra', 'Non-Manglik', 25, FALSE, TRUE),
('7', TRUE, 'Dr. Vikram Singh', 'Male', 34, 'Pediatrics', 'MD, DM (Neonatology)',
 'Max Super Speciality Hospital', 'Delhi', 'Delhi', 'India',
 ARRAY['Cycling','Fitness','Music'], 'https://randomuser.me/api/portraits/men/7.jpg',
 'Straight', 'Asian', 'Hindu', 'Rajput', NULL, 'Vashishtha', 'Hindi',
 'Karka (Cancer)', 'Pushya', 'Non-Manglik', 28, TRUE, TRUE),
('8', TRUE, 'Dr. Sneha Mukherjee', 'Female', 29, 'Gynecology', 'MS (Obstetrics & Gynecology)',
 'AMRI Hospitals', 'Kolkata', 'West Bengal', 'India',
 ARRAY['Classical Dance','Baking','Teaching'], 'https://randomuser.me/api/portraits/women/8.jpg',
 'Straight', 'Asian', 'Hindu', 'Brahmin', 'Mukherjee', 'Bharadwaj', 'Bengali',
 'Simha (Leo)', 'Purva Phalguni', 'Non-Manglik', 30, TRUE, FALSE),
('9', TRUE, 'Dr. Aditya Sharma', 'Male', 31, 'Cardiology', 'MD, DM (Cardiology)',
 'Lilavati Hospital', 'Mumbai', 'Maharashtra', 'India',
 ARRAY['Cricket','Trekking','Cooking'], 'https://randomuser.me/api/portraits/men/54.jpg',
 'Straight', 'Asian', 'Hindu', 'Brahmin', 'Sharma', 'Kashyap', 'Hindi',
 'Mesha (Aries)', 'Ashwini', 'Non-Manglik', 32, TRUE, TRUE),
('10', TRUE, 'Dr. Priya Patel', 'Female', 29, 'Neurology', 'MD (Neurology), MBBS',
 'Apollo Hospital', 'Delhi', 'Delhi', 'India',
 ARRAY['Painting','Yoga','Travel'], 'https://randomuser.me/api/portraits/women/67.jpg',
 'Straight', 'Asian', 'Hindu', 'Patel', NULL, 'Vishwamitra', 'Gujarati',
 'Vrishabha (Taurus)', 'Rohini', 'Non-Manglik', 29, TRUE, FALSE),
('11', TRUE, 'Dr. Rajesh Gupta', 'Male', 33, 'Orthopedics', 'MS (Orthopedics), MCh',
 'Fortis Hospital', 'Bangalore', 'Karnataka', 'India',
 ARRAY['Football','Guitar','Photography'], 'https://randomuser.me/api/portraits/men/35.jpg',
 'Straight', 'Asian', 'Hindu', 'Gupta', NULL, 'Garg', 'Hindi',
 'Mithuna (Gemini)', 'Punarvasu', 'Anshik Manglik', 27, TRUE, TRUE),
('12', TRUE, 'Dr. Ananya Reddy', 'Female', 28, 'Dermatology', 'MD (Dermatology), DNB',
 'KIMS Hospital', 'Hyderabad', 'Telangana', 'India',
 ARRAY['Badminton','Painting','Movies'], 'https://randomuser.me/api/portraits/women/44.jpg',
 'Straight', 'Asian', 'Hindu', 'Reddy', NULL, 'Atreya', 'Telugu',
 'Kanya (Virgo)', 'Hasta', 'Non-Manglik', 31, TRUE, FALSE),
('13', TRUE, 'Dr. Siddharth Deshmukh', 'Male', 32, 'General Surgery', 'MS (General Surgery), DNB',
 'KEM Hospital', 'Pune', 'Maharashtra', 'India',
 ARRAY['Marathon Running','Reading','Chess'], 'https://randomuser.me/api/portraits/men/86.jpg',
 'Straight', 'Asian', 'Hindu', 'Maratha', 'Deshmukh', 'Jamadagni', 'Marathi',
 'Tula (Libra)', 'Svati', 'Non-Manglik', 28, TRUE, TRUE),
('14', TRUE, 'Dr. Meera Iyer', 'Female', 30, 'Radiology', 'MD (Radiology), MBBS',
 'Apollo Main Hospital', 'Chennai', 'Tamil Nadu', 'India',
 ARRAY['Bharatanatyam','Cooking','Astronomy'], 'https://randomuser.me/api/portraits/women/79.jpg',
 'Straight', 'Asian', 'Hindu', 'Iyer', NULL, 'Bharadwaj', 'Tamil',
 'Karka (Cancer)', 'Ashlesha', 'Non-Manglik', 26, TRUE, FALSE),
('15', TRUE, 'Dr. Rohan Deshmukh', 'Male', 33, 'Veterinary Surgery', 'BVSc & AH / MVSc',
 'State Veterinary Super Specialty Hospital', 'Nagpur', 'Maharashtra', 'India',
 ARRAY['Animal Welfare','Trekking','Wildlife Photography'], 'https://randomuser.me/api/portraits/men/52.jpg',
 'Straight', 'Asian', 'Hindu', 'Maratha', NULL, 'Jamadagni', 'Marathi',
 'Dhanu (Sagittarius)', 'Purva Ashadha', 'Non-Manglik', 30, TRUE, TRUE),
('16', TRUE, 'Dr. Anjali Bhatt', 'Female', 29, 'Homeopathic Medicine', 'BHMS',
 'Hahnemann Homeopathic Care', 'Ahmedabad', 'Gujarat', 'India',
 ARRAY['Classical Music','Baking','Yoga'], 'https://randomuser.me/api/portraits/women/72.jpg',
 'Straight', 'Asian', 'Hindu', 'Brahmin', 'Bhatt', 'Shandilya', 'Gujarati',
 'Kanya (Virgo)', 'Hasta', 'Non-Manglik', 32, TRUE, FALSE),
('17', TRUE, 'Nithya Menon', 'Female', 28, 'Nursing / Critical Care', 'M.Sc Nursing / NP',
 'Aster Medcity', 'Kochi', 'Kerala', 'India',
 ARRAY['Singing','Travel','Badminton'], 'https://randomuser.me/api/portraits/women/33.jpg',
 'Straight', 'Asian', 'Hindu', 'Nair', NULL, 'Vishwamitra', 'Malayalam',
 'Mithuna (Gemini)', 'Ardra', 'Non-Manglik', 27, TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

UPDATE profiles SET about_me = 'Dedicated medical professional passionate about healthcare excellence and balanced living.',
  looking_for = 'Seeking a thoughtful partner who values family and mutual respect.'
WHERE about_me IS NULL AND is_sample;


-- ============================================================================
-- Maintenance block (audit fixes; idempotent on BOTH fresh and existing DBs)
-- ============================================================================

-- Audit L4: idx_subscriptions_user duplicated the PK's leading column.
DROP INDEX IF EXISTS idx_subscriptions_user;

-- Audit C1/H1 (existing DBs): subscriptions were keyed (user_id) alone. Rebuild
-- to (user_id, sku) so a consultation booking and a membership can coexist.
-- Legacy rows are one-per-user, so they remain unique under (user_id, sku).
DO $$
DECLARE conname TEXT;
BEGIN
  SELECT c.conname INTO conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
   WHERE c.conrelid = 'subscriptions'::regclass
     AND c.contype = 'p'
     AND array_length(c.conkey, 1) = 1
     AND a.attname = 'user_id'
   LIMIT 1;
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE subscriptions DROP CONSTRAINT %I', conname);
    ALTER TABLE subscriptions ADD PRIMARY KEY (user_id, sku);
  END IF;
END $$;

-- Audit M5: canonical channel pairs (no self, no reversed ordering).
DO $$
DECLARE conname TEXT;
BEGIN
  SELECT conname INTO conname FROM pg_constraint
    WHERE conrelid = 'channels'::regclass AND contype = 'u' ORDER BY conname LIMIT 1;
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE channels DROP CONSTRAINT %I', conname);
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