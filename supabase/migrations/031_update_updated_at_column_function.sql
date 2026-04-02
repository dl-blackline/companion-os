-- Ensure shared updated_at trigger function exists before downstream migrations.
-- This function is referenced by triggers in 032_premium_finance_intelligence.sql
-- and must be created before that migration runs.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
