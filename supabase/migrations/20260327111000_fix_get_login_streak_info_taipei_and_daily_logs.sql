-- Ensure daily check-in status is consistent after relogin/switching pages.
-- Use Asia/Taipei day boundary and also check daily_logins for idempotency.

CREATE OR REPLACE FUNCTION public.get_login_streak_info(p_user_id uuid)
RETURNS TABLE (
  current_streak integer,
  total_login_days integer,
  last_login_date date,
  can_claim_today boolean,
  streak_reward_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_login_date date;
  v_current_streak integer;
  v_total_login_days integer;
  v_today date;
  v_has_today_log boolean := false;
BEGIN
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date;

  SELECT
    p.last_login_date,
    COALESCE(p.login_streak, 0),
    COALESCE(p.total_login_days, 0)
  INTO
    v_last_login_date,
    v_current_streak,
    v_total_login_days
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, NULL::date, false, false;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.daily_logins dl
    WHERE dl.user_id = p_user_id
      AND dl.login_date = v_today
  ) INTO v_has_today_log;

  RETURN QUERY
  SELECT
    v_current_streak,
    v_total_login_days,
    v_last_login_date,
    NOT (
      v_last_login_date = v_today
      OR v_has_today_log
    ) AS can_claim_today,
    (v_current_streak >= 4 AND v_current_streak < 5) AS streak_reward_available;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_streak_info(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
