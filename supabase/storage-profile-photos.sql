-- ============================================================================
-- MedicoMatch Supabase storage: profile-photos bucket (run ONCE in the
-- Supabase SQL editor, Dashboard -> SQL Editor, or `supabase db push`).
--
-- The API uploads via the service-role key (see SUPABASE_URL /
-- SUPABASE_SERVICE_KEY in server/.env.example and the upload path at
-- server/src/index.mjs:2997-3080). Public delivery uses the public object
-- URL. Authenticated end users must NOT have direct write access, so there
-- is deliberately NO INSERT policy for the anon/authenticated roles.
-- ============================================================================

-- Bucket: public read, 2 MB object limit, image MIME types only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  TRUE,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read for profile photos (matches the bucket's purpose: these URLs are
-- embedded in browse/detail responses as imageUrl).
DROP POLICY IF EXISTS "profile-photos public read" ON storage.objects;
CREATE POLICY "profile-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

-- Belt and braces: no INSERT/UPDATE/DELETE for anyone except the service role
-- (which bypasses RLS entirely). Dropping possible leftovers is idempotent.
DROP POLICY IF EXISTS "profile-photos anon write" ON storage.objects;
DROP POLICY IF EXISTS "profile-photos authenticated write" ON storage.objects;
