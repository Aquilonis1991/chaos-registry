-- ==========================================
-- 更新 add_tokens_from_ad_watch 函數，從 system_config 讀取每日觀看廣告限制
-- ==========================================

-- 更新 add_tokens_from_ad_watch 函數，從 system_config 讀取配置
CREATE OR REPLACE FUNCTION public.add_tokens_from_ad_watch(
  p_token_amount integer DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_ad_watch_count integer;
  v_last_login_date date;
  v_today date;
  v_max_ads_per_day integer;
  v_config_value jsonb;
BEGIN
  -- 驗證 1: 必須是認證用戶
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User must be authenticated';
  END IF;

  -- 從 system_config 讀取每日觀看廣告限制
  -- 優先使用 max_ads_per_day，如果不存在則使用 mission_watch_ad_limit
  SELECT value INTO v_config_value
  FROM public.system_config
  WHERE key = 'max_ads_per_day';
  
  IF v_config_value IS NULL THEN
    SELECT value INTO v_config_value
    FROM public.system_config
    WHERE key = 'mission_watch_ad_limit';
  END IF;
  
  -- 解析配置值（可能是數字或字符串）
  IF v_config_value IS NULL THEN
    v_max_ads_per_day := 10; -- 默認值
  ELSIF jsonb_typeof(v_config_value) = 'number' THEN
    v_max_ads_per_day := (v_config_value)::integer;
  ELSIF jsonb_typeof(v_config_value) = 'string' THEN
    v_max_ads_per_day := (v_config_value #>> '{}')::integer;
  ELSE
    v_max_ads_per_day := 10; -- 默認值
  END IF;

  -- 驗證 2: 獲取當前觀看次數
  SELECT ad_watch_count, COALESCE(last_login::date, '1970-01-01'::date)
  INTO v_ad_watch_count, v_last_login_date
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 驗證 3: 檢查每日限制
  v_today := CURRENT_DATE;
  IF v_last_login_date != v_today THEN
    -- 新的一天，重置計數
    v_ad_watch_count := 0;
  END IF;

  IF v_ad_watch_count >= v_max_ads_per_day THEN
    RAISE EXCEPTION 'Daily ad watch limit reached: Maximum % ads per day', v_max_ads_per_day;
  END IF;

  -- 驗證 4: 代幣數量必須為正數且合理
  IF p_token_amount <= 0 OR p_token_amount > 100 THEN
    RAISE EXCEPTION 'Invalid token amount: Must be between 1 and 100';
  END IF;

  -- 執行更新（原子操作）
  UPDATE public.profiles
  SET 
    tokens = tokens + p_token_amount,
    ad_watch_count = CASE 
      WHEN COALESCE(last_login::date, '1970-01-01'::date) = v_today THEN ad_watch_count + 1 
      ELSE 1 
    END,
    last_login = now()
  WHERE id = v_user_id;

  -- 記錄交易
  INSERT INTO public.token_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    v_user_id,
    p_token_amount,
    'watch_ad',
    '觀看廣告'
  );

  -- 記錄審計日誌
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    metadata
  ) VALUES (
    v_user_id,
    'watch_ad',
    'ad',
    jsonb_build_object(
      'reward', p_token_amount,
      'daily_count', CASE 
        WHEN COALESCE(last_login::date, '1970-01-01'::date) = v_today THEN ad_watch_count + 1 
        ELSE 1 
      END
    )
  );
END;
$$;

-- 授予執行權限
GRANT EXECUTE ON FUNCTION public.add_tokens_from_ad_watch(integer) TO authenticated;

-- 驗證函數
SELECT 
  '✅ add_tokens_from_ad_watch 函數已更新，現在從 system_config 讀取配置' as status,
  proname as function_name
FROM pg_proc
WHERE proname = 'add_tokens_from_ad_watch'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

