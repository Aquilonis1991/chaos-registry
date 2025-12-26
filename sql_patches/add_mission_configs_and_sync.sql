-- Add Mission & Reward Configs and Sync Logic

-- 1. Insert missing config keys
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('mission_create_topic_reward', '50', 'mission', '發起主題任務獎勵'),
  ('mission_vote_reward', '50', 'mission', '投票任務獎勵 (對 10 個不同主題投票)'),
  ('free_create_daily_login_days', '3', 'mission', '獲得免費發起主題券所需連續登入天數'),
  ('new_user_tokens', '100', 'user', '新用戶初始代幣')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- 2. Create a function to sync mission rewards from config
CREATE OR REPLACE FUNCTION public.sync_mission_rewards_from_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync topic_creator reward
  IF NEW.key = 'mission_create_topic_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE(NEW.value::INTEGER, 50)
    WHERE id = 'topic_creator';
  END IF;

  -- Sync vote_lover reward
  IF NEW.key = 'mission_vote_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE(NEW.value::INTEGER, 50)
    WHERE id = 'vote_lover';
  END IF;

  -- Sync watch_ad reward (Config 'watch_ad_reward' -> Mission 'watch_ad')
  IF NEW.key = 'watch_ad_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE(NEW.value::INTEGER, 5)
    WHERE id = 'watch_ad';
  END IF;
  
   -- Sync daily_login reward (Config 'daily_login_reward' -> Mission 'daily_login')
  IF NEW.key = 'daily_login_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE(NEW.value::INTEGER, 3)
    WHERE id = 'daily_login';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Trigger on system_config
DROP TRIGGER IF EXISTS trigger_sync_mission_rewards ON public.system_config;

CREATE TRIGGER trigger_sync_mission_rewards
AFTER INSERT OR UPDATE ON public.system_config
FOR EACH ROW
EXECUTE FUNCTION public.sync_mission_rewards_from_config();

-- 4. Run explicit sync once to ensure current state is consistent
DO $$
DECLARE
  v_create_reward TEXT;
  v_vote_reward TEXT;
  v_ad_reward TEXT;
  v_login_reward TEXT;
BEGIN
  SELECT value INTO v_create_reward FROM public.system_config WHERE key = 'mission_create_topic_reward';
  SELECT value INTO v_vote_reward FROM public.system_config WHERE key = 'mission_vote_reward';
  SELECT value INTO v_ad_reward FROM public.system_config WHERE key = 'watch_ad_reward';
  SELECT value INTO v_login_reward FROM public.system_config WHERE key = 'daily_login_reward';

  IF v_create_reward IS NOT NULL THEN
    UPDATE public.missions SET reward = v_create_reward::INTEGER WHERE id = 'topic_creator';
  END IF;

  IF v_vote_reward IS NOT NULL THEN
    UPDATE public.missions SET reward = v_vote_reward::INTEGER WHERE id = 'vote_lover';
  END IF;
  
  IF v_ad_reward IS NOT NULL THEN
     UPDATE public.missions SET reward = v_ad_reward::INTEGER WHERE id = 'watch_ad';
  END IF;
  
  IF v_login_reward IS NOT NULL THEN
     UPDATE public.missions SET reward = v_login_reward::INTEGER WHERE id = 'daily_login';
  END IF;
END $$;
