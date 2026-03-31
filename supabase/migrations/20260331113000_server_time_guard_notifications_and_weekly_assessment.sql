-- Ensure time-sensitive features rely on server time (not client clock)

-- 1) Mark single notification as read with server timestamp
-- Compatibility: old deployments may already have mark_notification_read(uuid)
-- with a different return type, so we must drop before re-creating.
DROP FUNCTION IF EXISTS public.mark_notification_read(uuid);

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS TABLE(id uuid, read_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  UPDATE public.notifications n
  SET
    is_read = true,
    read_at = now()
  WHERE n.id = p_notification_id
    AND n.user_id = v_user_id
  RETURNING n.id, n.read_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO service_role;

-- 2) Weekly assessment status based on server time (Asia/Taipei)
DROP FUNCTION IF EXISTS public.get_weekly_assessment_status();

CREATE OR REPLACE FUNCTION public.get_weekly_assessment_status()
RETURNS TABLE(
  done boolean,
  title text,
  description text,
  created_at timestamptz,
  week_start_taipei timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_week_start_taipei timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Monday 00:00 in Asia/Taipei, converted to timestamptz
  v_week_start_taipei := (date_trunc('week', now() AT TIME ZONE 'Asia/Taipei') AT TIME ZONE 'Asia/Taipei');

  RETURN QUERY
  SELECT
    (ua.created_at >= v_week_start_taipei) AS done,
    ua.title,
    ua.description,
    ua.created_at,
    v_week_start_taipei
  FROM public.user_assessments ua
  WHERE ua.user_id = v_user_id
  ORDER BY ua.created_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_weekly_assessment_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_assessment_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_assessment_status() TO service_role;

NOTIFY pgrst, 'reload schema';

