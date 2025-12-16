-- ========================================
-- 添加每日簽到調試日誌
-- 用於追蹤簽到流程中的問題
-- ========================================

-- 更新 record_daily_login 函數，添加詳細的日誌記錄
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
  v_last_login_date DATE;
  v_current_streak INTEGER;
  v_total_days INTEGER;
  v_is_new_login BOOLEAN := false;
  v_reward_tokens INTEGER := 0;
  v_today DATE;
  v_debug_info TEXT;
  v_new_token_balance INTEGER;
  v_old_token_balance INTEGER;
BEGIN
  -- 使用明確的時區獲取今天的日期（使用台灣時區 UTC+8）
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE;
  
  -- 使用 SELECT FOR UPDATE 鎖定行，防止並發重複執行
  SELECT last_login_date, login_streak, total_login_days
  INTO v_last_login_date, v_current_streak, v_total_days
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE; -- 鎖定行，防止並發重複執行

  -- 如果 profile 不存在，初始化
  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
    v_total_days := 0;
  END IF;

  -- 記錄調試資訊（可以通過 RAISE NOTICE 查看，但這裡我們記錄到變數中）
  v_debug_info := format('User: %s, Today: %s, Last login: %s, Streak: %s, Total days: %s', 
    p_user_id, v_today, v_last_login_date, v_current_streak, v_total_days);
  
  -- 檢查是否已經在今天登入過（使用明確的日期比較）
  IF v_last_login_date = v_today THEN
    -- 已經在今天登入過，不發放獎勵
    RAISE NOTICE 'Daily login already claimed today. %', v_debug_info;
    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;

  -- 檢查 daily_logins 表中是否已有今天的記錄（雙重檢查）
  IF EXISTS (
    SELECT 1 FROM public.daily_logins
    WHERE user_id = p_user_id AND login_date = v_today
  ) THEN
    -- 已有記錄，不發放獎勵
    RAISE NOTICE 'Daily login record already exists in daily_logins table. %', v_debug_info;
    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;

  -- 這是今天的新登入
  v_is_new_login := true;
  v_total_days := v_total_days + 1;

  -- 檢查是否連續登入（昨天是最後登入日）
  IF v_last_login_date = v_today - INTERVAL '1 day' THEN
    -- 連續登入
    v_current_streak := v_current_streak + 1;
    RAISE NOTICE 'Consecutive login. %', v_debug_info;
  ELSIF v_last_login_date IS NULL THEN
    -- 首次登入
    v_current_streak := 1;
    RAISE NOTICE 'First login ever. %', v_debug_info;
  ELSE
    -- 連勝中斷，重新開始
    v_current_streak := 1;
    RAISE NOTICE 'Streak broken, restarting. %', v_debug_info;
  END IF;

  -- 計算獎勵（每日登入 3 代幣）
  v_reward_tokens := 3;

  -- 記錄登入到 daily_logins 表（使用 ON CONFLICT 防止重複）
  INSERT INTO public.daily_logins (user_id, login_date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, login_date) DO NOTHING;

  -- 更新 profile
  UPDATE public.profiles
  SET 
    last_login_date = v_today,
    login_streak = v_current_streak,
    total_login_days = v_total_days,
    last_login = now()
  WHERE id = p_user_id;

  -- 獲取發放前的代幣餘額（用於驗證）
  SELECT tokens INTO v_old_token_balance
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- 發放獎勵代幣（使用原子性操作）
  PERFORM public.add_tokens(p_user_id, v_reward_tokens);
  
  -- 驗證代幣是否成功發放
  SELECT tokens INTO v_new_token_balance
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF v_new_token_balance IS NULL THEN
    RAISE EXCEPTION 'Failed to verify token balance after adding tokens';
  END IF;
  
  IF v_new_token_balance != (COALESCE(v_old_token_balance, 0) + v_reward_tokens) THEN
    RAISE WARNING 'Token balance mismatch! Old: %, Added: %, Expected: %, Actual: %', 
      v_old_token_balance, v_reward_tokens, 
      COALESCE(v_old_token_balance, 0) + v_reward_tokens, 
      v_new_token_balance;
  ELSE
    RAISE NOTICE 'Tokens added successfully. Old balance: %, Added: %, New balance: %', 
      v_old_token_balance, v_reward_tokens, v_new_token_balance;
  END IF;

  -- 記錄交易
  INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, v_reward_tokens, 'complete_mission', '每日登入獎勵')
  ON CONFLICT DO NOTHING; -- 防止重複記錄

  -- 完成 daily_login 任務（如果任務存在）
  -- 使用 UPSERT 邏輯，確保任務被標記為完成
  -- 先檢查任務是否存在
  IF EXISTS (SELECT 1 FROM public.missions WHERE id = 'daily_login') THEN
    INSERT INTO public.user_missions (
      user_id,
      mission_id,
      completed,
      completed_at,
      last_completed_date,
      progress
    )
    VALUES (
      p_user_id,
      'daily_login',
      true,
      now(),
      v_today,
      100
    )
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
    
    RAISE NOTICE 'Daily login mission completed. %', v_debug_info;
  ELSE
    RAISE NOTICE 'Daily login mission not found in missions table. %', v_debug_info;
  END IF;

  -- 檢查是否達到 5 天連勝（免費發起資格獎勵）
  IF v_current_streak = 5 THEN
    -- 授予免費發起資格
    INSERT INTO public.free_create_qualifications (
      user_id,
      source,
      description
    )
    VALUES (
      p_user_id,
      'consecutive_login_5',
      '連續登入5天獎勵'
    )
    ON CONFLICT DO NOTHING;
    RAISE NOTICE '5-day streak reached, free create qualification granted. %', v_debug_info;
  END IF;

  RAISE NOTICE 'Daily login successful. New login: %, Streak: %, Total days: %, Reward: % tokens. %', 
    v_is_new_login, v_current_streak, v_total_days, v_reward_tokens, v_debug_info;

  RETURN QUERY SELECT v_is_new_login, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

-- 添加註釋
COMMENT ON FUNCTION public.record_daily_login IS '記錄每日登入，發放代幣獎勵，完成 daily_login 任務，使用台灣時區（UTC+8）確保日期判斷準確，包含詳細的調試日誌';


