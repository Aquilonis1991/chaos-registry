-- ==========================================
-- 修復簽到功能 - 創建缺失的函數和表
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- 1. 添加登入追蹤欄位到 profiles 表（如果不存在）
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_date DATE,
ADD COLUMN IF NOT EXISTS total_login_days INTEGER NOT NULL DEFAULT 0;

-- 2. 創建 daily_logins 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.daily_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, login_date)
);

-- 啟用 RLS
ALTER TABLE public.daily_logins ENABLE ROW LEVEL SECURITY;

-- 刪除舊政策（如果存在）
DROP POLICY IF EXISTS "Users can view own login history" ON public.daily_logins;
DROP POLICY IF EXISTS "Users can insert own login records" ON public.daily_logins;

-- 創建政策
CREATE POLICY "Users can view own login history"
  ON public.daily_logins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own login records"
  ON public.daily_logins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_daily_logins_user_date ON public.daily_logins(user_id, login_date DESC);

-- 3. 創建 add_tokens 函數（如果不存在，record_daily_login 需要它）
CREATE OR REPLACE FUNCTION public.add_tokens(user_id UUID, token_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET tokens = tokens + token_amount
  WHERE id = user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- 4. 創建 record_daily_login 函數
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
BEGIN
  -- Get current profile data
  SELECT last_login_date, login_streak, total_login_days
  INTO v_last_login_date, v_current_streak, v_total_days
  FROM public.profiles
  WHERE id = p_user_id;

  -- If profile doesn't exist, initialize with defaults
  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
    v_total_days := 0;
  END IF;

  -- Check if already logged in today
  IF v_last_login_date = CURRENT_DATE THEN
    -- Already logged in today, no reward
    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;

  -- This is a new login for today
  v_is_new_login := true;
  v_total_days := v_total_days + 1;

  -- Check if consecutive (yesterday was last login)
  IF v_last_login_date = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Consecutive login
    v_current_streak := v_current_streak + 1;
  ELSIF v_last_login_date IS NULL THEN
    -- First login ever
    v_current_streak := 1;
  ELSE
    -- Streak broken, restart
    v_current_streak := 1;
  END IF;

  -- Calculate reward (3 tokens for daily login)
  v_reward_tokens := 3;

  -- Record login in daily_logins table
  INSERT INTO public.daily_logins (user_id, login_date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, login_date) DO NOTHING;

  -- Update profile
  UPDATE public.profiles
  SET 
    last_login_date = CURRENT_DATE,
    login_streak = v_current_streak,
    total_login_days = v_total_days,
    last_login = now()
  WHERE id = p_user_id;

  -- Add reward tokens
  PERFORM public.add_tokens(p_user_id, v_reward_tokens);
  -- 注意：add_tokens 函數使用 user_id 和 token_amount 參數
  -- 但 PostgreSQL 會自動匹配參數名稱，所以可以直接傳遞

  -- Log transaction (if table exists, ignore errors if it doesn't)
  BEGIN
    INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, v_reward_tokens, 'complete_mission', '每日登入獎勵');
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if table doesn't exist
    NULL;
  END;

  RETURN QUERY SELECT v_is_new_login, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

-- 5. 創建 get_login_streak_info 函數（可選，用於顯示登入資訊）
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
  v_last_login_date DATE;
  v_current_streak INTEGER;
  v_total_days INTEGER;
BEGIN
  SELECT last_login_date, login_streak, total_login_days
  INTO v_last_login_date, v_current_streak, v_total_days
  FROM public.profiles
  WHERE id = p_user_id;

  -- Handle NULL values
  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
  END IF;
  IF v_total_days IS NULL THEN
    v_total_days := 0;
  END IF;

  RETURN QUERY SELECT 
    v_current_streak,
    v_total_days,
    v_last_login_date,
    (v_last_login_date IS NULL OR v_last_login_date < CURRENT_DATE) as can_claim_today,
    (v_current_streak >= 4 AND v_current_streak < 5) as streak_reward_available;
END;
$$;

-- 6. 驗證函數是否創建成功
SELECT 
  '✅ 函數創建檢查' as status,
  COUNT(*) FILTER (WHERE proname = 'record_daily_login') as record_daily_login_exists,
  COUNT(*) FILTER (WHERE proname = 'get_login_streak_info') as get_login_streak_info_exists,
  COUNT(*) FILTER (WHERE proname = 'add_tokens') as add_tokens_exists
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('record_daily_login', 'get_login_streak_info', 'add_tokens');

-- 7. 驗證表是否存在
SELECT 
  '✅ 表檢查' as status,
  COUNT(*) FILTER (WHERE tablename = 'daily_logins') as daily_logins_exists
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'daily_logins';

-- 8. 驗證欄位是否存在
SELECT 
  '✅ 欄位檢查' as status,
  COUNT(*) FILTER (WHERE column_name = 'login_streak') as login_streak_exists,
  COUNT(*) FILTER (WHERE column_name = 'last_login_date') as last_login_date_exists,
  COUNT(*) FILTER (WHERE column_name = 'total_login_days') as total_login_days_exists
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('login_streak', 'last_login_date', 'total_login_days');

