-- ============================================================
-- Migration 021: Add pg_trgm and storage UPDATE policy
-- ============================================================
-- Fixes gaps caught by contract verification:
-- 1) Ensure pg_trgm extension is installed.
-- 2) Allow authenticated users to update metadata/path details
--    on their own media objects within media_uploads bucket.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE POLICY "media_uploads_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'media_uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'media_uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
