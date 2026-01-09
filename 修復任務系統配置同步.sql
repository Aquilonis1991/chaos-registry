-- ==========================================
-- 修復任務系統配置同步
-- 設置同步觸發器，確保 system_config 更新時自動同步到 missions 表
-- ==========================================

BEGIN;

-- 1. 確保同步函數存在（如果不存在則創建）
CREATE OR REPLACE FUNCTION public.sync_mission_rewards_from_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync topic_creator (mission_create_topic_reward)
  IF NEW.key = 'mission_create_topic_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE((NEW.value::text)::INTEGER, 50)
    WHERE id = 'topic_creator';
  END IF;

  -- Sync vote_lover (mission_vote_lover_reward)
  IF NEW.key = 'mission_vote_lover_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE((NEW.value::text)::INTEGER, 50)
    WHERE id = 'vote_lover';
  END IF;
  
  -- Sync first_vote (mission_first_vote_reward)
  IF NEW.key = 'mission_first_vote_reward' THEN
     UPDATE public.missions
     SET reward = COALESCE((NEW.value::text)::INTEGER, 50)
     WHERE id = 'first_vote';
  END IF;

  -- Sync watch_ad (mission_watch_ad_reward)
  IF NEW.key = 'mission_watch_ad_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE((NEW.value::text)::INTEGER, 5)
    WHERE id = 'watch_ad';
  END IF;
  
  -- Sync daily_login (mission_daily_login_reward)
  IF NEW.key = 'mission_daily_login_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE((NEW.value::text)::INTEGER, 3)
    WHERE id = 'daily_login';
  END IF;

  -- Sync 7days login (mission_7days_login_reward_tokens)
  IF NEW.key = 'mission_7days_login_reward_tokens' THEN
     UPDATE public.missions
     SET reward = COALESCE((NEW.value::text)::INTEGER, 100)
     WHERE id = 'login_7days';
  END IF;

  -- 處理舊配置名稱的遷移
  IF NEW.key = 'daily_login_reward' THEN
    UPDATE public.missions 
    SET reward = COALESCE((NEW.value::text)::INTEGER, 3)
    WHERE id = 'daily_login';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 刪除舊的觸發器（如果存在）
DROP TRIGGER IF EXISTS trigger_sync_mission_rewards ON public.system_config;

-- 3. 創建新的觸發器
CREATE TRIGGER trigger_sync_mission_rewards
  AFTER INSERT OR UPDATE ON public.system_config
  FOR EACH ROW
  WHEN (NEW.key LIKE 'mission_%' OR NEW.key = 'daily_login_reward')
  EXECUTE FUNCTION public.sync_mission_rewards_from_config();

-- 4. 手動執行一次同步，確保當前配置已同步到 missions 表
DO $$
DECLARE
  v_config_val TEXT;
  v_reward_val INTEGER;
BEGIN
  -- Sync mission_create_topic_reward
  SELECT value::text INTO v_config_val FROM public.system_config WHERE key = 'mission_create_topic_reward';
  IF v_config_val IS NOT NULL THEN
    v_reward_val := v_config_val::INTEGER;
    UPDATE public.missions SET reward = v_reward_val WHERE id = 'topic_creator';
  END IF;

  -- Sync mission_vote_lover_reward
  SELECT value::text INTO v_config_val FROM public.system_config WHERE key = 'mission_vote_lover_reward';
  IF v_config_val IS NOT NULL THEN
    v_reward_val := v_config_val::INTEGER;
    UPDATE public.missions SET reward = v_reward_val WHERE id = 'vote_lover';
  END IF;

  -- Sync mission_first_vote_reward
  SELECT value::text INTO v_config_val FROM public.system_config WHERE key = 'mission_first_vote_reward';
  IF v_config_val IS NOT NULL THEN
    v_reward_val := v_config_val::INTEGER;
    UPDATE public.missions SET reward = v_reward_val WHERE id = 'first_vote';
  END IF;

  -- Sync mission_watch_ad_reward
  SELECT value::text INTO v_config_val FROM public.system_config WHERE key = 'mission_watch_ad_reward';
  IF v_config_val IS NOT NULL THEN
    v_reward_val := v_config_val::INTEGER;
    UPDATE public.missions SET reward = v_reward_val WHERE id = 'watch_ad';
  END IF;

  -- Sync mission_daily_login_reward
  SELECT value::text INTO v_config_val FROM public.system_config WHERE key = 'mission_daily_login_reward';
  IF v_config_val IS NULL THEN
    SELECT value::text INTO v_config_val FROM public.system_config WHERE key = 'daily_login_reward';
  END IF;
  IF v_config_val IS NOT NULL THEN
    v_reward_val := v_config_val::INTEGER;
    UPDATE public.missions SET reward = v_reward_val WHERE id = 'daily_login';
  END IF;

  -- Sync mission_7days_login_reward_tokens
  SELECT value::text INTO v_config_val FROM public.system_config WHERE key = 'mission_7days_login_reward_tokens';
  IF v_config_val IS NOT NULL THEN
    v_reward_val := v_config_val::INTEGER;
    UPDATE public.missions SET reward = v_reward_val WHERE id = 'login_7days';
  END IF;
END $$;

-- 5. 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==========================================
-- 驗證修復結果
-- ==========================================
SELECT 
  '修復驗證' as section,
  '同步函數狀態' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' 
      AND p.proname = 'sync_mission_rewards_from_config'
    ) THEN '✓ 已設置'
    ELSE '✗ 未設置'
  END as status
UNION ALL
SELECT 
  '修復驗證',
  '同步觸發器狀態',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
      AND c.relname = 'system_config'
      AND t.tgname = 'trigger_sync_mission_rewards'
      AND NOT t.tgisinternal
    ) THEN '✓ 已設置'
    ELSE '✗ 未設置'
  END;


