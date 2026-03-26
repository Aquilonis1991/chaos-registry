-- Idempotent patch: ensure nickname_updated_at column + trigger exists, then reload PostgREST schema.
-- One-time migration (safe to re-run).
-- Security: nickname_updated_at is set server-side via trigger to avoid client spoofing mission completion.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nickname_updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_nickname_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nickname IS DISTINCT FROM OLD.nickname THEN
    NEW.nickname_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_nickname_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_nickname_updated_at
BEFORE UPDATE OF nickname ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_nickname_updated_at();

-- Refresh Schema Cache (PostgREST)
NOTIFY pgrst, 'reload schema';

