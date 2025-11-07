-- Enhance mission system for daily login and consecutive login tracking

-- Add login tracking columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_date DATE,
ADD COLUMN IF NOT EXISTS total_login_days INTEGER NOT NULL DEFAULT 0;

-- Create daily_logins table to track login history
CREATE TABLE IF NOT EXISTS public.daily_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  login_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, login_date)
);

-- Enable RLS
ALTER TABLE public.daily_logins ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own login history"
  ON public.daily_logins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own login records"
  ON public.daily_logins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_daily_logins_user_date ON public.daily_logins(user_id, login_date DESC);

-- Function to record daily login and update streak
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

  -- Log transaction
  INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, v_reward_tokens, 'complete_mission', '每日登入獎勵');

  -- Check if reached 5-day streak (free create qualification reward)
  IF v_current_streak = 5 THEN
    -- Grant free create qualification
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
  END IF;

  RETURN QUERY SELECT v_is_new_login, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

-- Function to get user's login streak info
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

  RETURN QUERY SELECT 
    v_current_streak,
    v_total_days,
    v_last_login_date,
    (v_last_login_date IS NULL OR v_last_login_date < CURRENT_DATE) as can_claim_today,
    (v_current_streak >= 4 AND v_current_streak < 5) as streak_reward_available;
END;
$$;

-- Insert/Update missions
INSERT INTO public.missions (id, name, condition, reward, limit_per_day) VALUES
  ('daily_login', '每日登入', '每天登入一次', 3, 1),
  ('consecutive_login_5', '連續登入5天', '連續5天登入獲得免費發起資格', 0, 0)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  condition = EXCLUDED.condition,
  reward = EXCLUDED.reward,
  limit_per_day = EXCLUDED.limit_per_day;

-- Add system config for mission settings
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('daily_login_reward', '3', 'mission', '每日登入獎勵代幣數'),
  ('consecutive_login_target', '5', 'mission', '連續登入目標天數'),
  ('consecutive_login_reward_type', 'free_create_qualification', 'mission', '連續登入獎勵類型')
ON CONFLICT (key) DO NOTHING;

