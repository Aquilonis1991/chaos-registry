-- free_create_qualifications has no "description" column (see 20250115000001_add_free_create_system.sql).
-- qualification_type is NOT NULL; use daily_login + source for 5-day streak reward.

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
    INSERT INTO public.free_create_qualifications (user_id, qualification_type, source)
    VALUES (p_user_id, 'daily_login', 'consecutive_login_5');
  END IF;

  RETURN QUERY SELECT true, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

COMMENT ON FUNCTION public.record_daily_login(uuid) IS '記錄每日簽到；連續第 5 天寫入 free_create_qualifications（qualification_type=daily_login, source=consecutive_login_5）。';

NOTIFY pgrst, 'reload schema';
