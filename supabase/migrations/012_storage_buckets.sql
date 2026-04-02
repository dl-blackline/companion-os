-- ============================================================
-- Migration 012: Storage Buckets
-- ============================================================
-- Creates the `media_uploads` Supabase Storage bucket used by
-- the chat and memory views to store user-uploaded images and
-- videos before they are passed to the media-memory pipeline.
--
-- NOTE: Supabase Storage is managed via the `storage` schema.
-- The INSERT statements below are idempotent (ON CONFLICT DO NOTHING).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media_uploads',
  'media_uploads',
  true,
  104857600,  -- 100 MB per file
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS policies for media_uploads bucket ───────────────────────────────────

DROP POLICY IF EXISTS "media_uploads_insert" ON storage.objects;
DROP POLICY IF EXISTS "media_uploads_select_own" ON storage.objects;
DROP POLICY IF EXISTS "media_uploads_public_read" ON storage.objects;
DROP POLICY IF EXISTS "media_uploads_delete_own" ON storage.objects;

-- Allow authenticated users to upload files under their own user-id prefix.
CREATE POLICY "media_uploads_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media_uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read their own files.
CREATE POLICY "media_uploads_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'media_uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public (unauthenticated) reads so that public_url links work.
-- This is intentional: media is referenced by public URL in analysis records.
CREATE POLICY "media_uploads_public_read"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'media_uploads');

-- Allow authenticated users to delete their own files.
CREATE POLICY "media_uploads_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media_uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
