-- User visual identity profiles (photo -> avatar/emojicon)
-- Stores original uploaded photo reference, generated variants, and active selection.

CREATE TABLE IF NOT EXISTS user_identity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_image_url TEXT NOT NULL,
  original_storage_path TEXT,
  original_filename TEXT,
  style_type TEXT NOT NULL CHECK (style_type IN ('avatar', 'emojicon')),
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_variant_index INT,
  selected_variant_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_identity_profiles_user_id
  ON user_identity_profiles(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identity_profiles_one_active
  ON user_identity_profiles(user_id)
  WHERE is_active = true;

ALTER TABLE user_identity_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_identity_profiles_owner"
  ON user_identity_profiles
  FOR ALL
  USING (user_id = auth.uid());
