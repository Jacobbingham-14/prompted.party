-- game-images is now written only by the generate-image edge function (service
-- role), so anonymous visitors can no longer upload arbitrary files that could
-- end up on the party screen or run up storage costs.
--
-- DEPLOY ORDER: apply this only after the generate-image function and the
-- frontend that stops uploading from the browser are both live; the old
-- frontend uploads directly and would break.

DROP POLICY IF EXISTS "Anyone can upload game images" ON storage.objects;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/jpeg'],
    file_size_limit = 5242880
WHERE id = 'game-images';

-- Closing the bucket isn't enough on its own: players write image URLs into
-- these columns directly, so pin them to our bucket. NOT VALID leaves existing
-- rows (e.g. old Replicate avatar links) alone and checks new writes only.
ALTER TABLE submissions
  ADD CONSTRAINT submissions_image_url_in_bucket
  CHECK (image_url LIKE 'https://qeswdvkflledzwkvipht.supabase.co/storage/v1/object/public/game-images/%') NOT VALID;

ALTER TABLE duel_submissions
  ADD CONSTRAINT duel_submissions_image_url_in_bucket
  CHECK (image_url IS NULL OR image_url LIKE 'https://qeswdvkflledzwkvipht.supabase.co/storage/v1/object/public/game-images/%') NOT VALID;

ALTER TABLE players
  ADD CONSTRAINT players_avatar_url_in_bucket
  CHECK (avatar_url IS NULL OR avatar_url LIKE 'https://qeswdvkflledzwkvipht.supabase.co/storage/v1/object/public/game-images/%') NOT VALID;
