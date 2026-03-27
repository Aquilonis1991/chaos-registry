-- Harden daily check-in flow against accidental profile field updates.
-- Core rule:
--   - "Can claim today" is determined ONLY by daily_logins (today record exists or not).
--   - record_daily_login idempotency is enforced by daily_logins unique key, not profile.last_login_date.

CREATE OR REPLACE FUNCTION public.record_daily_login(p_user_id uuid)
RETURNS TABLE (
  is_new_login boolean,
  current_streak integer,
  total_days integer,
  reward_tokens integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_prev_claim_date date;
  v_current_streak integer := 0;
  v_total_days integer := 0;
  v_reward_tokens integer := 3;
  v_reward_text text;
  v_rows integer := 0;
BEGIN
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date;

  SELECT COALESCE(p.login_streak, 0), COALESCE(p.total_login_days, 0)
  INTO v_current_streak, v_total_days
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 0;
    RETURN;
  END IF;

  SELECT MAX(dl.login_date)
  INTO v_prev_claim_date
  FROM public.daily_logins dl
  WHERE dl.user_id = p_user_id
    AND dl.login_date < v_today;

  INSERT INTO public.daily_logins (user_id, login_date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, login_date) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;

  SELECT (sc.value #>> '{}')
  INTO v_reward_text
  FROM public.system_config sc
  WHERE sc.key = 'mission_daily_login_reward'
  LIMIT 1;

  BEGIN
    v_reward_tokens := COALESCE(NULLIF(btrim(v_reward_text), '')::integer, 3);
  EXCEPTION WHEN OTHERS THEN
    v_reward_tokens := 3;
  END;

  IF v_reward_tokens < 0 THEN
    v_reward_tokens := 0;
  END IF;

  IF v_prev_claim_date = (v_today - INTERVAL '1 day')::date THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
  ELSE
    v_current_streak := 1;
  END IF;
  v_total_days := COALESCE(v_total_days, 0) + 1;

  UPDATE public.profiles
  SET
    last_login_date = v_today,
    login_streak = v_current_streak,
    total_login_days = v_total_days,
    last_login = now(),
    updated_at = now()
  WHERE id = p_user_id;

  IF v_reward_tokens > 0 THEN
    PERFORM public.add_tokens(p_user_id, v_reward_tokens);

    INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, v_reward_tokens, 'complete_mission', '每日簽到獎勵');
  END IF;

  IF EXISTS (SELECT 1 FROM public.missions WHERE id = 'daily_login') THEN
    INSERT INTO public.user_missions (user_id, mission_id, completed, completed_at, last_completed_date, progress)
    VALUES (p_user_id, 'daily_login', true, now(), v_today, 100)
    ON CONFLICT (user_id, mission_id)
    DO UPDATE SET
      completed = true,
      completed_at = CASE
        WHEN user_missions.last_completed_date < v_today THEN now()
        ELSE user_missions.completed_at
      END,
      last_completed_date = v_today,
      progress = 100,
      updated_at = now();
  END IF;

  IF v_current_streak = 5 THEN
    INSERT INTO public.free_create_qualifications (user_id, source, description)
    VALUES (p_user_id, 'consecutive_login_5', '連續登入5天獎勵')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT true, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

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
  v_profile_last_login_date date;
  v_current_streak integer;
  v_total_login_days integer;
  v_last_claim_date date;
  v_today date;
  v_has_today_log boolean := false;
BEGIN
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date;

  SELECT
    p.last_login_date,
    COALESCE(p.login_streak, 0),
    COALESCE(p.total_login_days, 0)
  INTO
    v_profile_last_login_date,
    v_current_streak,
    v_total_login_days
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, NULL::date, false, false;
    RETURN;
  END IF;

  SELECT MAX(dl.login_date)
  INTO v_last_claim_date
  FROM public.daily_logins dl
  WHERE dl.user_id = p_user_id;

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
    COALESCE(v_last_claim_date, v_profile_last_login_date),
    NOT v_has_today_log AS can_claim_today,
    (v_current_streak >= 4 AND v_current_streak < 5) AS streak_reward_available;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_daily_login(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_streak_info(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
