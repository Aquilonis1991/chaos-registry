-- Align daily-login ticket grant behavior with system_config keys:
-- - consecutive_login_reward_type
-- - free_create_daily_login_days
-- - mission_7days_login_reward_ticket
-- Also keep mission_daily_login_reward as token reward source.

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

  -- configurable ticket-reward behavior
  v_reward_type text := 'free_create_qualification';
  v_reward_type_text text;
  v_ticket_enabled boolean := true;
  v_ticket_enabled_text text;
  v_ticket_days integer := 5;
  v_ticket_days_text text;
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

  -- token reward amount
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

  -- ticket reward type
  SELECT (sc.value #>> '{}')
  INTO v_reward_type_text
  FROM public.system_config sc
  WHERE sc.key = 'consecutive_login_reward_type'
  LIMIT 1;
  IF v_reward_type_text IS NOT NULL AND btrim(v_reward_type_text) <> '' THEN
    v_reward_type := btrim(v_reward_type_text);
  END IF;

  -- ticket reward enabled switch
  SELECT (sc.value #>> '{}')
  INTO v_ticket_enabled_text
  FROM public.system_config sc
  WHERE sc.key = 'mission_7days_login_reward_ticket'
  LIMIT 1;
  BEGIN
    IF v_ticket_enabled_text IS NOT NULL THEN
      v_ticket_enabled := COALESCE(NULLIF(btrim(v_ticket_enabled_text), '')::boolean, true);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ticket_enabled := true;
  END;

  -- ticket reward required days
  SELECT (sc.value #>> '{}')
  INTO v_ticket_days_text
  FROM public.system_config sc
  WHERE sc.key = 'free_create_daily_login_days'
  LIMIT 1;
  BEGIN
    IF v_ticket_days_text IS NOT NULL THEN
      v_ticket_days := COALESCE(NULLIF(btrim(v_ticket_days_text), '')::integer, 5);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ticket_days := 5;
  END;
  IF v_ticket_days < 1 THEN
    v_ticket_days := 1;
  END IF;

  IF v_prev_claim_date = (v_today - INTERVAL '1 day')::date THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
  ELSE
    v_current_streak := 1;
  END IF;
  v_total_days := COALESCE(v_total_days, 0) + 1;

  -- after completing day-30 cycle, next day starts from 1
  IF v_current_streak > 30 THEN
    v_current_streak := 1;
  END IF;

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
      completed_at = CASE WHEN user_missions.last_completed_date < v_today THEN now() ELSE user_missions.completed_at END,
      last_completed_date = v_today,
      progress = 100,
      updated_at = now();
  END IF;

  -- ticket grant fully aligned to config keys
  IF v_ticket_enabled
     AND v_reward_type = 'free_create_qualification'
     AND v_current_streak = v_ticket_days THEN
    INSERT INTO public.free_create_qualifications (user_id, qualification_type, source)
    VALUES (p_user_id, 'daily_login', 'consecutive_login_' || v_ticket_days::text);
  END IF;

  RETURN QUERY SELECT true, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

COMMENT ON FUNCTION public.record_daily_login IS
'記錄每日登入：代幣獎勵讀 mission_daily_login_reward；發券邏輯讀 consecutive_login_reward_type / free_create_daily_login_days / mission_7days_login_reward_ticket';

NOTIFY pgrst, 'reload schema';

