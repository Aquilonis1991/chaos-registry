-- Sync mission rewards with system_config (including nickname change mission)
-- This enables "任務獎勵" page to take effect immediately.

CREATE OR REPLACE FUNCTION public.sync_mission_rewards_from_config()
RETURNS TRIGGER AS $$
DECLARE
  v_reward integer;
BEGIN
  -- Only care about mission reward keys
  IF NEW.key = 'mission_first_vote_reward' THEN
    v_reward := COALESCE(NULLIF(TRIM(NEW.value #>> '{}'), '')::integer, 50);
    UPDATE public.missions SET reward = v_reward WHERE id = 'first_vote';
  ELSIF NEW.key = 'mission_vote_lover_reward' THEN
    v_reward := COALESCE(NULLIF(TRIM(NEW.value #>> '{}'), '')::integer, 50);
    UPDATE public.missions SET reward = v_reward WHERE id = 'vote_lover';
  ELSIF NEW.key = 'mission_create_topic_reward' THEN
    v_reward := COALESCE(NULLIF(TRIM(NEW.value #>> '{}'), '')::integer, 50);
    UPDATE public.missions SET reward = v_reward WHERE id = 'topic_creator';
  ELSIF NEW.key = 'mission_7days_login_reward_tokens' THEN
    v_reward := COALESCE(NULLIF(TRIM(NEW.value #>> '{}'), '')::integer, 100);
    UPDATE public.missions SET reward = v_reward WHERE id = 'login_7days';
  ELSIF NEW.key = 'mission_nickname_change_reward' THEN
    v_reward := COALESCE(NULLIF(TRIM(NEW.value #>> '{}'), '')::integer, 20);
    UPDATE public.missions SET reward = v_reward WHERE id = 'nickname_editor';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_mission_rewards ON public.system_config;
CREATE TRIGGER trigger_sync_mission_rewards
AFTER INSERT OR UPDATE ON public.system_config
FOR EACH ROW
EXECUTE FUNCTION public.sync_mission_rewards_from_config();

-- Refresh Schema Cache (PostgREST)
NOTIFY pgrst, 'reload schema';

