-- Clean up unused system_config keys and unify naming conventions

-- 1. Migrate values from legacy keys if new keys are missing or default
DO $$
DECLARE
  v_legacy_limit INT;
  v_new_limit INT;
  v_legacy_reward INT;
  v_new_reward INT;
BEGIN
  -- Migrate max_ads_per_day -> mission_watch_ad_limit
  SELECT (value::TEXT)::INT INTO v_legacy_limit FROM public.system_config WHERE key = 'max_ads_per_day';
  SELECT (value::TEXT)::INT INTO v_new_limit FROM public.system_config WHERE key = 'mission_watch_ad_limit';
  
  -- If legacy exists and new doesn't (or is default), copy legacy value
  IF v_legacy_limit IS NOT NULL AND (v_new_limit IS NULL OR v_new_limit = 10) THEN
    INSERT INTO public.system_config (key, value, category, description)
    VALUES ('mission_watch_ad_limit', v_legacy_limit::TEXT, 'mission', '每日觀看廣告上限')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  -- Migrate ad_reward_amount -> mission_watch_ad_reward
  SELECT (value::TEXT)::INT INTO v_legacy_reward FROM public.system_config WHERE key = 'ad_reward_amount';
  SELECT (value::TEXT)::INT INTO v_new_reward FROM public.system_config WHERE key = 'mission_watch_ad_reward';

  IF v_legacy_reward IS NOT NULL AND (v_new_reward IS NULL OR v_new_reward = 5) THEN
    INSERT INTO public.system_config (key, value, category, description)
    VALUES ('mission_watch_ad_reward', v_legacy_reward::TEXT, 'mission', '觀看廣告獎勵')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  -- Ensure mission_watch_ad_reward exists if not created above
  INSERT INTO public.system_config (key, value, category, description)
  VALUES ('mission_watch_ad_reward', '5', 'mission', '觀看廣告獎勵')
  ON CONFLICT (key) DO NOTHING;
END $$;

-- 2. Update Trigger Function to use new key
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

  -- Sync watch_ad reward (UPDATED: Listen to 'mission_watch_ad_reward')
  IF NEW.key = 'mission_watch_ad_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE(NEW.value::INTEGER, 5)
    WHERE id = 'watch_ad';
  END IF;
  
   -- Sync daily_login reward
  IF NEW.key = 'daily_login_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE(NEW.value::INTEGER, 3)
    WHERE id = 'daily_login';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Delete Legacy Keys
DELETE FROM public.system_config WHERE key IN (
  'watch_ad_reward',      -- Replaced by mission_watch_ad_reward
  'watch_ad_daily_limit', -- Replaced by mission_watch_ad_limit
  'max_ads_per_day',      -- Replaced by mission_watch_ad_limit
  'ad_reward_amount'      -- Replaced by mission_watch_ad_reward
);

-- 4. Verify by listing current keys (Optional, purely for debug log)
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE 'Cleaning complete. Current keys:';
  FOR r IN SELECT key, value FROM public.system_config ORDER BY key LOOP
    RAISE NOTICE '%: %', r.key, r.value;
  END LOOP;
END $$;
