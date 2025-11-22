-- 強化每日登入與連續登入統計，確保任務進度正確
BEGIN;

-- 1. 確保 profiles 具有所需欄位
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_date DATE,
  ADD COLUMN IF NOT EXISTS total_login_days INTEGER NOT NULL DEFAULT 0;

-- 2. 重新建立 record_daily_login 函式，重新計算連續登入
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
  v_today DATE := CURRENT_DATE;
  v_reward_tokens INTEGER := 3;
  v_last_login_date DATE;
  v_current_streak INTEGER := 0;
  v_total_days INTEGER := 0;
  v_day_offset INTEGER;
  v_login_exists BOOLEAN;
  v_reward_setting TEXT;
BEGIN
  -- 讀取獎勵設定（若存在）
  SELECT value INTO v_reward_setting
  FROM public.system_config
  WHERE key = 'daily_login_reward';

  IF v_reward_setting IS NOT NULL THEN
    v_reward_tokens := COALESCE(v_reward_setting::INTEGER, 3);
  END IF;

  -- 鎖定用戶資料，確保一致性
  SELECT last_login_date INTO v_last_login_date
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', v_user_id;
  END IF;

  -- 檢查是否已經簽到
  IF v_last_login_date = v_today THEN
    SELECT login_streak, total_login_days
      INTO v_current_streak, v_total_days
    FROM public.profiles
    WHERE id = v_user_id;

    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;

  -- 記錄今天的登入
  INSERT INTO public.daily_logins (user_id, login_date)
  VALUES (v_user_id, v_today)
  ON CONFLICT (user_id, login_date) DO NOTHING;

  -- 重新計算總登入天數
  SELECT COUNT(*) INTO v_total_days
  FROM public.daily_logins
  WHERE user_id = v_user_id;

  -- 以最新登入日為基準計算連續登入天數
  WITH ordered_logins AS (
    SELECT
      dl.login_date,
      ROW_NUMBER() OVER (ORDER BY dl.login_date DESC) AS rn
    FROM public.daily_logins dl
    WHERE dl.user_id = v_user_id
  ),
  latest_login AS (
    SELECT MAX(login_date) AS max_login_date
    FROM ordered_logins
  ),
  streak_cte AS (
    SELECT COUNT(*) AS streak
    FROM ordered_logins ol
    CROSS JOIN latest_login ll
    WHERE ll.max_login_date IS NOT NULL
      AND ll.max_login_date - ol.login_date = ol.rn - 1
  )
  SELECT COALESCE(streak, 0) INTO v_current_streak
  FROM streak_cte;

  -- 更新 profiles
  UPDATE public.profiles
  SET
    last_login_date = v_today,
    login_streak = v_current_streak,
    total_login_days = v_total_days,
    last_login = now(),
    updated_at = now()
  WHERE id = v_user_id;

  -- 發放獎勵代幣
  PERFORM public.add_tokens(v_user_id, v_reward_tokens);

  -- 記錄交易（若表存在）
  BEGIN
    INSERT INTO public.token_transactions (
      user_id,
      amount,
      transaction_type,
      description
    )
    VALUES (
      v_user_id,
      v_reward_tokens,
      'complete_mission',
      '每日登入獎勵'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT true, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

-- 3. 重新建立 get_login_streak_info，從 daily_logins 計算
DROP FUNCTION IF EXISTS public.get_login_streak_info(uuid);

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
  v_target INTEGER := 7;
  v_target_setting TEXT;
  v_last_login date;
  v_total_days INTEGER := 0;
  v_current_streak INTEGER := 0;
BEGIN
  -- 讀取連續登入目標設定
  SELECT value INTO v_target_setting
  FROM public.system_config
  WHERE key = 'consecutive_login_target';

  IF v_target_setting IS NOT NULL THEN
    v_target := COALESCE(v_target_setting::INTEGER, 7);
  END IF;

  -- 取得最後登入日期與總登入天數
  WITH ordered_logins AS (
    SELECT
      dl.login_date,
      ROW_NUMBER() OVER (ORDER BY dl.login_date DESC) AS rn
    FROM public.daily_logins dl
    WHERE dl.user_id = p_user_id
  ),
  summary AS (
    SELECT
      MAX(login_date) AS max_login_date,
      COUNT(*) AS total_days
    FROM ordered_logins
  ),
  streak_cte AS (
    SELECT COUNT(*) AS streak
    FROM ordered_logins ol
    CROSS JOIN summary s
    WHERE s.max_login_date IS NOT NULL
      AND s.max_login_date - ol.login_date = ol.rn - 1
  )
  SELECT
    s.max_login_date,
    COALESCE(s.total_days, 0),
    COALESCE(sc.streak, 0)
  INTO
    v_last_login,
    v_total_days,
    v_current_streak
  FROM summary s
  LEFT JOIN streak_cte sc ON TRUE;

  IF v_last_login IS NULL THEN
    RETURN QUERY SELECT 0, 0, NULL::date, true, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_current_streak,
    v_total_days,
    v_last_login,
    (v_last_login < CURRENT_DATE),
    (v_current_streak >= v_target - 1 AND v_current_streak < v_target);
END;
$$;

-- 4. 重新整理 schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;


