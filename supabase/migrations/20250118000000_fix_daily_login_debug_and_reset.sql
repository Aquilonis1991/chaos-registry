-- ========================================
-- 每日簽到調試與修復
-- 問題：用戶反映簽到功能異常，系統誤判為已簽到
-- 解決：添加更詳細的日誌，並提供診斷函數
-- ========================================

-- 創建診斷函數，檢查用戶的簽到狀態
CREATE OR REPLACE FUNCTION public.check_daily_login_status(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  today_date date,
  last_login_date date,
  login_streak integer,
  total_login_days integer,
  can_claim_today boolean,
  has_daily_login_record boolean,
  daily_login_record_date date,
  profile_tokens integer,
  timezone_info text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE;
  v_last_login_date DATE;
  v_streak INTEGER;
  v_total_days INTEGER;
  v_has_record BOOLEAN;
  v_record_date DATE;
  v_tokens INTEGER;
  v_timezone TEXT;
BEGIN
  -- 獲取今天的日期（台灣時區）
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE;
  v_timezone := 'Asia/Taipei (UTC+8)';
  
  -- 獲取用戶資料（使用表別名避免歧義）
  SELECT p.last_login_date, p.login_streak, p.total_login_days, p.tokens
  INTO v_last_login_date, v_streak, v_total_days, v_tokens
  FROM public.profiles p
  WHERE p.id = p_user_id;
  
  -- 檢查 daily_logins 表中是否有今天的記錄（使用表別名避免歧義）
  SELECT EXISTS(
    SELECT 1 FROM public.daily_logins dl
    WHERE dl.user_id = p_user_id AND dl.login_date = v_today
  ), 
  (SELECT MAX(dl2.login_date) FROM public.daily_logins dl2 WHERE dl2.user_id = p_user_id)
  INTO v_has_record, v_record_date;
  
  RETURN QUERY SELECT 
    p_user_id,
    v_today,
    v_last_login_date,
    COALESCE(v_streak, 0),
    COALESCE(v_total_days, 0),
    (v_last_login_date IS NULL OR v_last_login_date < v_today) AND NOT v_has_record,
    v_has_record,
    v_record_date,
    COALESCE(v_tokens, 0),
    v_timezone;
END;
$$;

-- 創建修復函數（僅用於調試，可以清除今天的簽到記錄）
CREATE OR REPLACE FUNCTION public.reset_today_daily_login(p_user_id uuid)
RETURNS TABLE (
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE;
  v_deleted_count INTEGER;
BEGIN
  -- 獲取今天的日期（台灣時區）
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE;
  
  -- 刪除今天的 daily_logins 記錄（使用表別名避免歧義）
  DELETE FROM public.daily_logins dl
  WHERE dl.user_id = p_user_id AND dl.login_date = v_today;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- 如果 last_login_date 是今天，重置為昨天（但保持其他數據不變）
  -- 注意：這只是為了測試，生產環境應該謹慎使用
  UPDATE public.profiles p
  SET last_login_date = v_today - INTERVAL '1 day'
  WHERE p.id = p_user_id 
    AND p.last_login_date = v_today;
  
  IF v_deleted_count > 0 THEN
    RETURN QUERY SELECT true, format('已清除 %s 的今日簽到記錄（%s）', p_user_id, v_today);
  ELSE
    RETURN QUERY SELECT false, format('未找到 %s 的今日簽到記錄（%s）', p_user_id, v_today);
  END IF;
END;
$$;

-- 更新 record_daily_login 函數，添加更詳細的 RAISE NOTICE
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
  v_has_daily_record BOOLEAN;
BEGIN
  -- 使用明確的時區獲取今天的日期（使用台灣時區 UTC+8）
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE;
  
  RAISE NOTICE '[record_daily_login] Starting for user: %, Today (Asia/Taipei): %', p_user_id, v_today;
  
  -- 使用 SELECT FOR UPDATE 鎖定行，防止並發重複執行
  SELECT p.last_login_date, p.login_streak, p.total_login_days
  INTO v_last_login_date, v_current_streak, v_total_days
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE; -- 鎖定行，防止並發重複執行

  -- 如果 profile 不存在，初始化
  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
    v_total_days := 0;
  END IF;

  -- 記錄調試資訊
  v_debug_info := format('User: %s, Today: %s, Last login: %s, Streak: %s, Total days: %s', 
    p_user_id, v_today, v_last_login_date, v_current_streak, v_total_days);
  
  RAISE NOTICE '[record_daily_login] Profile data: %', v_debug_info;
  
  -- 檢查是否已經在今天登入過（使用明確的日期比較）
  IF v_last_login_date = v_today THEN
    -- 已經在今天登入過，不發放獎勵
    RAISE NOTICE '[record_daily_login] ❌ Already claimed today (last_login_date = today). %', v_debug_info;
    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;

  -- 檢查 daily_logins 表中是否已有今天的記錄（雙重檢查，使用表別名避免歧義）
  SELECT EXISTS(
    SELECT 1 FROM public.daily_logins dl
    WHERE dl.user_id = p_user_id AND dl.login_date = v_today
  ) INTO v_has_daily_record;
  
  IF v_has_daily_record THEN
    -- 已有記錄，不發放獎勵
    RAISE NOTICE '[record_daily_login] ❌ Daily login record already exists in daily_logins table. %', v_debug_info;
    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;

  -- 這是今天的新登入
  v_is_new_login := true;
  v_total_days := v_total_days + 1;
  
  RAISE NOTICE '[record_daily_login] ✅ This is a new login for today. %', v_debug_info;

  -- 檢查是否連續登入（昨天是最後登入日）
  IF v_last_login_date = v_today - INTERVAL '1 day' THEN
    -- 連續登入
    v_current_streak := v_current_streak + 1;
    RAISE NOTICE '[record_daily_login] ✅ Consecutive login. %', v_debug_info;
  ELSIF v_last_login_date IS NULL THEN
    -- 首次登入
    v_current_streak := 1;
    RAISE NOTICE '[record_daily_login] ✅ First login ever. %', v_debug_info;
  ELSE
    -- 連勝中斷，重新開始
    v_current_streak := 1;
    RAISE NOTICE '[record_daily_login] ⚠️ Streak broken, restarting. Last login: %, Today: %', v_last_login_date, v_today;
  END IF;

  -- 計算獎勵（每日登入 3 代幣）
  v_reward_tokens := 3;

  -- 記錄登入到 daily_logins 表（使用 ON CONFLICT 防止重複）
  INSERT INTO public.daily_logins (user_id, login_date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, login_date) DO NOTHING;
  
  RAISE NOTICE '[record_daily_login] ✅ Inserted into daily_logins table. %', v_debug_info;

  -- 更新 profile
  UPDATE public.profiles
  SET 
    last_login_date = v_today,
    login_streak = v_current_streak,
    total_login_days = v_total_days,
    last_login = now()
  WHERE id = p_user_id;
  
  RAISE NOTICE '[record_daily_login] ✅ Updated profile. %', v_debug_info;

  -- 獲取發放前的代幣餘額（用於驗證）
  SELECT p.tokens INTO v_old_token_balance
  FROM public.profiles p
  WHERE p.id = p_user_id;
  
  RAISE NOTICE '[record_daily_login] Before adding tokens. Old balance: %', v_old_token_balance;

  -- 發放獎勵代幣（使用原子性操作）
  PERFORM public.add_tokens(p_user_id, v_reward_tokens);
  
  -- 驗證代幣是否成功發放
  SELECT p.tokens INTO v_new_token_balance
  FROM public.profiles p
  WHERE p.id = p_user_id;
  
  IF v_new_token_balance IS NULL THEN
    RAISE EXCEPTION 'Failed to verify token balance after adding tokens';
  END IF;
  
  IF v_new_token_balance != (COALESCE(v_old_token_balance, 0) + v_reward_tokens) THEN
    RAISE WARNING '[record_daily_login] ⚠️ Token balance mismatch! User: %, Expected: %, Actual: %', 
      p_user_id, (COALESCE(v_old_token_balance, 0) + v_reward_tokens), v_new_token_balance;
  ELSE
    RAISE NOTICE '[record_daily_login] ✅ Tokens added successfully. New balance: %, Added: %', 
      v_new_token_balance, v_reward_tokens;
  END IF;

  -- 記錄交易
  INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, v_reward_tokens, 'complete_mission', '每日登入獎勵')
  ON CONFLICT DO NOTHING; -- 防止重複記錄
  
  RAISE NOTICE '[record_daily_login] ✅ Recorded token transaction. %', v_debug_info;

  -- 完成 daily_login 任務（如果任務存在）
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
    
    RAISE NOTICE '[record_daily_login] ✅ Daily login mission completed. %', v_debug_info;
  ELSE
    RAISE WARNING '[record_daily_login] ⚠️ Daily login mission not found in missions table. %', v_debug_info;
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
    RAISE NOTICE '[record_daily_login] ✅ 5-day streak reached, free create qualification granted. %', v_debug_info;
  END IF;

  RAISE NOTICE '[record_daily_login] ✅ SUCCESS! New login: %, Streak: %, Total days: %, Reward: % tokens. %', 
    v_is_new_login, v_current_streak, v_total_days, v_reward_tokens, v_debug_info;

  RETURN QUERY SELECT v_is_new_login, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

-- 添加註釋
COMMENT ON FUNCTION public.check_daily_login_status IS '診斷用戶的每日簽到狀態，用於調試';
COMMENT ON FUNCTION public.reset_today_daily_login IS '重置今天的簽到記錄（僅用於調試，謹慎使用）';
COMMENT ON FUNCTION public.record_daily_login IS '記錄每日登入，發放代幣獎勵，完成 daily_login 任務，使用台灣時區（UTC+8）確保日期判斷準確，包含詳細的調試日誌';

