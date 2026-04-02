-- ============================================================
-- Migration 035: Auto-bootstrap user_roles & user_entitlements
--
-- Creates a trigger on auth.users so every new signup gets a
-- default 'user' role and 'free' / 'active' entitlement row.
-- Also backfills any existing users who are missing rows.
-- ============================================================

-- ── Bootstrap function ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_entitlements (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── Trigger on auth.users ───────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Backfill existing users who lack rows ───────────────────

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_entitlements (user_id, plan, status)
SELECT id, 'free', 'active' FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_entitlements)
ON CONFLICT (user_id) DO NOTHING;
