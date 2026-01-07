-- ==========================================
-- Mission System Overhaul & Config Cleanup
-- ==========================================

BEGIN;

-- 1. Insert/Update all Mission System Configs with defaults
--    We use "mission_" prefix for consistency.
--    Explicitly cast values to ::jsonb to avoid type errors.
INSERT INTO public.system_config (key, value, category, description) VALUES
  -- New Users
  ('mission_first_vote_reward', '50'::jsonb, 'mission', '新手上路 (首次投票) 獎勵代幣'),
  
  -- Vote Lover
  ('mission_vote_lover_target', '10'::jsonb, 'mission', '投票愛好者任務目標次數'),
  ('mission_vote_lover_reward', '50'::jsonb, 'mission', '投票愛好者任務獎勵代幣'),
  
  -- Topic Creator
  ('mission_create_topic_reward', '50'::jsonb, 'mission', '話題創造者 (首次發起) 獎勵代幣'),
  
  -- Watch Ad (Already exists, ensuring consistency)
  ('mission_watch_ad_limit', '10'::jsonb, 'mission', '每日觀看廣告上限'),
  ('mission_watch_ad_reward', '5'::jsonb, 'mission', '每次觀看廣告獎勵'),
  
  -- Daily Login (Simple)
  ('mission_daily_login_reward', '3'::jsonb, 'mission', '每日簽到獎勵代幣 (原 daily_login_reward)'),
  
  -- 7-Day Streak (Complex)
  ('mission_7days_login_target', '7'::jsonb, 'mission', '連續登入任務目標天數 (原 consecutive_login_target)'),
  ('mission_7days_login_reward_tokens', '100'::jsonb, 'mission', '連續登入任務獎勵代幣'),
  ('mission_7days_login_reward_ticket', 'true'::jsonb, 'mission', '連續登入任務是否獎勵免費發起券')

ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;
  -- Note: We generally preserve existing VALUE on conflict, but for new keys it sets default.

-- 2. Migrate Legacy Values (if they exist and are non-default) to new keys
DO $$
DECLARE
  v_old_val TEXT;
BEGIN
  -- 2.1 Migrate daily_login_reward -> mission_daily_login_reward
  SELECT value::TEXT INTO v_old_val FROM public.system_config WHERE key = 'daily_login_reward';
  IF v_old_val IS NOT NULL THEN
    UPDATE public.system_config SET value = v_old_val::jsonb WHERE key = 'mission_daily_login_reward';
  END IF;

  -- 2.2 Migrate consecutive_login_target -> mission_7days_login_target
  SELECT value::TEXT INTO v_old_val FROM public.system_config WHERE key = 'consecutive_login_target';
  IF v_old_val IS NOT NULL THEN
    UPDATE public.system_config SET value = v_old_val::jsonb WHERE key = 'mission_7days_login_target';
  END IF;

  -- 2.3 Migrate max_ads_per_day -> mission_watch_ad_limit
  SELECT value::TEXT INTO v_old_val FROM public.system_config WHERE key = 'max_ads_per_day';
  IF v_old_val IS NOT NULL THEN
     UPDATE public.system_config SET value = v_old_val::jsonb WHERE key = 'mission_watch_ad_limit';
  END IF;
  
  -- 2.4 Migrate ad_reward_amount/watch_ad_reward -> mission_watch_ad_reward
  -- (Prioritize watch_ad_reward if both exist)
  SELECT value::TEXT INTO v_old_val FROM public.system_config WHERE key = 'watch_ad_reward';
  IF v_old_val IS NULL THEN
     SELECT value::TEXT INTO v_old_val FROM public.system_config WHERE key = 'ad_reward_amount';
  END IF;
  IF v_old_val IS NOT NULL THEN
     UPDATE public.system_config SET value = v_old_val::jsonb WHERE key = 'mission_watch_ad_reward';
  END IF;

END $$;


-- 3. Update Sync Trigger to listen to NEW keys and update 'missions' table
CREATE OR REPLACE FUNCTION public.sync_mission_rewards_from_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync topic_creator (mission_create_topic_reward)
  IF NEW.key = 'mission_create_topic_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE(NEW.value::INTEGER, 50)
    WHERE id = 'topic_creator';
  END IF;

  -- Sync vote_lover (mission_vote_lover_reward)
  IF NEW.key = 'mission_vote_lover_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE(NEW.value::INTEGER, 50)
    WHERE id = 'vote_lover';
  END IF;
  
  -- Sync first_vote (mission_first_vote_reward) - NEW
  IF NEW.key = 'mission_first_vote_reward' THEN
     UPDATE public.missions
     SET reward = COALESCE(NEW.value::INTEGER, 50)
     WHERE id = 'first_vote';
  END IF;

  -- Sync watch_ad (mission_watch_ad_reward)
  IF NEW.key = 'mission_watch_ad_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE(NEW.value::INTEGER, 5)
    WHERE id = 'watch_ad';
  END IF;
  
   -- Sync daily_login (mission_daily_login_reward)
  IF NEW.key = 'mission_daily_login_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE(NEW.value::INTEGER, 3)
    WHERE id = 'daily_login';
  END IF;
  
  -- Sync 7days login (mission_7days_login_reward_tokens)
  -- Note: This mission might reward tokens + ticket, here we sync the token amount
  IF NEW.key = 'mission_7days_login_reward_tokens' THEN
     UPDATE public.missions
     SET reward = COALESCE(NEW.value::INTEGER, 100)
     WHERE id = 'login_7days';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 4. Recreate record_daily_login RPC with DYNAMIC logic & FIXING LOST TICKET BUG
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
  
  -- Configuration Variables
  v_daily_reward_amount INT;
  v_streak_target INT;
  v_streak_reward_ticket BOOLEAN;
  v_config_val TEXT;
BEGIN
  -- 4.1 Load Configuration (Dynamic)
  -- Daily Login Reward
  SELECT value::TEXT INTO v_config_val FROM public.system_config WHERE key = 'mission_daily_login_reward';
  v_daily_reward_amount := COALESCE(v_config_val::INTEGER, 3);
  
  -- Streak Target (for Free Ticket) - Defaulting to 7 if not set, to match UI intent
  SELECT value::TEXT INTO v_config_val FROM public.system_config WHERE key = 'mission_7days_login_target';
  v_streak_target := COALESCE(v_config_val::INTEGER, 7);
  
  -- Streak Reward Ticket Enabled
  SELECT value::TEXT INTO v_config_val FROM public.system_config WHERE key = 'mission_7days_login_reward_ticket';
  v_streak_reward_ticket := COALESCE(v_config_val::BOOLEAN, true);

  -- 4.2 Standard Login Logic
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE;
  
  SELECT last_login_date, login_streak, total_login_days
  INTO v_last_login_date, v_current_streak, v_total_days
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE; 

  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
    v_total_days := 0;
  END IF;

  IF v_last_login_date = v_today THEN
    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;
  
  -- Double check usage
  IF EXISTS (SELECT 1 FROM public.daily_logins WHERE user_id = p_user_id AND login_date = v_today) THEN
    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;

  v_is_new_login := true;
  v_total_days := v_total_days + 1;

  IF v_last_login_date = v_today - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
  ELSIF v_last_login_date IS NULL THEN
    v_current_streak := 1;
  ELSE
    v_current_streak := 1;
  END IF;

  v_reward_tokens := v_daily_reward_amount;

  INSERT INTO public.daily_logins (user_id, login_date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, login_date) DO NOTHING;

  UPDATE public.profiles
  SET 
    last_login_date = v_today,
    login_streak = v_current_streak,
    total_login_days = v_total_days,
    last_login = now()
  WHERE id = p_user_id;

  PERFORM public.add_tokens(p_user_id, v_reward_tokens);

  INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, v_reward_tokens, 'complete_mission', '每日登入獎勵')
  ON CONFLICT DO NOTHING;

  -- Complete daily_login task
  IF EXISTS (SELECT 1 FROM public.missions WHERE id = 'daily_login') THEN
    INSERT INTO public.user_missions (user_id, mission_id, completed, completed_at, last_completed_date, progress)
    VALUES (p_user_id, 'daily_login', true, now(), v_today, 100)
    ON CONFLICT (user_id, mission_id) 
    DO UPDATE SET completed = true, last_completed_date = v_today, progress = 100, updated_at = now();
  END IF;

  -- 4.3 Check Streak Target (Dynamic) & Grant Ticket
  IF v_current_streak = v_streak_target AND v_streak_reward_ticket THEN
    INSERT INTO public.free_create_qualifications (user_id, source, description)
    VALUES (p_user_id, 'consecutive_login_' || v_streak_target, '連續登入' || v_streak_target || '天獎勵')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_is_new_login, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;


-- 5. Delete Legacy Keys
DELETE FROM public.system_config WHERE key IN (
  'watch_ad_reward',
  'watch_ad_daily_limit', -- Replaced by mission_watch_ad_limit
  'max_ads_per_day',      -- Replaced by mission_watch_ad_limit
  'ad_reward_amount',      -- Replaced by mission_watch_ad_reward
  'daily_login_reward',    -- Replaced by mission_daily_login_reward
  'consecutive_login_target' -- Replaced by mission_7days_login_target
);

-- 6. Trigger one manual sync to update missions table immediately
UPDATE public.system_config SET updated_at = now() WHERE key LIKE 'mission_%';

COMMIT;
