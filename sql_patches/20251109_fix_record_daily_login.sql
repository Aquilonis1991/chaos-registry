-- 修復 record_daily_login 函式，避免引用不存在的欄位
DROP FUNCTION IF EXISTS public.record_daily_login(uuid);

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
  v_user_id ALIAS FOR $1;
  v_last_login_date DATE;
  v_current_streak INTEGER;
  v_total_days INTEGER;
  v_is_new_login BOOLEAN := false;
  v_reward_tokens INTEGER := 0;
BEGIN
  SELECT last_login_date, login_streak, total_login_days
  INTO v_last_login_date, v_current_streak, v_total_days
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_last_login_date = CURRENT_DATE THEN
    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;

  v_is_new_login := true;
  v_total_days := v_total_days + 1;

  IF v_last_login_date = CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
  ELSE
    v_current_streak := 1;
  END IF;

  v_reward_tokens := 3;

  INSERT INTO public.daily_logins (user_id, login_date)
  VALUES (v_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, login_date) DO NOTHING;

  UPDATE public.profiles
  SET
    last_login_date = CURRENT_DATE,
    login_streak = v_current_streak,
    total_login_days = v_total_days,
    last_login = now()
  WHERE id = v_user_id;

  PERFORM public.add_tokens(v_user_id, v_reward_tokens);

  INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
  VALUES (v_user_id, v_reward_tokens, 'complete_mission', '每日登入獎勵');

  RETURN QUERY SELECT v_is_new_login, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

