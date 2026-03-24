-- ============================================================
-- Migration 022: SECURITY DEFINER search_path hardening
-- ============================================================
-- Ensure SECURITY DEFINER trigger function uses explicit search_path
-- to prevent object shadowing vulnerabilities.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles(id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
