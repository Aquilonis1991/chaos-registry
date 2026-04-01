-- Add repeatable daily vote missions and repeatable streak missions.
-- Rewards are configurable from system_config.

-- 1) Config keys (reward adjustable from admin/system config)
INSERT INTO public.system_config (key, value, category, description)
VALUES
  ('mission_daily_vote_1_reward', '3'::jsonb, 'mission', '每日投票 1 票任務獎勵'),
  ('mission_daily_vote_5_reward', '5'::jsonb, 'mission', '每日投票 5 票任務獎勵'),
  ('mission_daily_vote_10_reward', '10'::jsonb, 'mission', '每日投票 10 票任務獎勵'),
  ('mission_streak_7_reward', '80'::jsonb, 'mission', '連續簽到 7 天任務獎勵'),
  ('mission_streak_14_reward', '200'::jsonb, 'mission', '連續簽到 14 天任務獎勵'),
  ('mission_streak_30_reward', '500'::jsonb, 'mission', '連續簽到 30 天任務獎勵')
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- 2) Missions
INSERT INTO public.missions (id, name, condition, reward, limit_per_day)
VALUES
  ('daily_vote_1', '每日投票(1票)', '當日累計投票 1 票', 3, 1),
  ('daily_vote_5', '每日投票(5票)', '當日累計投票 5 票', 5, 1),
  ('daily_vote_10', '每日投票(10票)', '當日累計投票 10 票', 10, 1),
  ('streak_7_repeat', '連續簽到 7 天', '當前連續簽到達 7 天（每個連續週期可領 1 次）', 80, NULL),
  ('streak_14_repeat', '連續簽到 14 天', '當前連續簽到達 14 天（每個連續週期可領 1 次）', 200, NULL),
  ('streak_30_repeat', '連續簽到 30 天', '當前連續簽到達 30 天（每個連續週期可領 1 次）', 500, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  condition = EXCLUDED.condition;

-- 3) Sync mission rewards from config
UPDATE public.missions SET reward = COALESCE((SELECT NULLIF(TRIM(value #>> '{}'), '')::integer FROM public.system_config WHERE key = 'mission_daily_vote_1_reward' LIMIT 1), reward)
WHERE id = 'daily_vote_1';
UPDATE public.missions SET reward = COALESCE((SELECT NULLIF(TRIM(value #>> '{}'), '')::integer FROM public.system_config WHERE key = 'mission_daily_vote_5_reward' LIMIT 1), reward)
WHERE id = 'daily_vote_5';
UPDATE public.missions SET reward = COALESCE((SELECT NULLIF(TRIM(value #>> '{}'), '')::integer FROM public.system_config WHERE key = 'mission_daily_vote_10_reward' LIMIT 1), reward)
WHERE id = 'daily_vote_10';
UPDATE public.missions SET reward = COALESCE((SELECT NULLIF(TRIM(value #>> '{}'), '')::integer FROM public.system_config WHERE key = 'mission_streak_7_reward' LIMIT 1), reward)
WHERE id = 'streak_7_repeat';
UPDATE public.missions SET reward = COALESCE((SELECT NULLIF(TRIM(value #>> '{}'), '')::integer FROM public.system_config WHERE key = 'mission_streak_14_reward' LIMIT 1), reward)
WHERE id = 'streak_14_repeat';
UPDATE public.missions SET reward = COALESCE((SELECT NULLIF(TRIM(value #>> '{}'), '')::integer FROM public.system_config WHERE key = 'mission_streak_30_reward' LIMIT 1), reward)
WHERE id = 'streak_30_repeat';

-- 4) Daily login reset rule: streak resets after reaching 30 and continue next day.
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
  v_today date;
  v_prev_claim_date date;
  v_current_streak integer := 0;
  v_total_days integer := 0;
  v_reward_tokens integer := 3;
  v_reward_text text;
  v_rows integer := 0;
BEGIN
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date;

  SELECT COALESCE(p.login_streak, 0), COALESCE(p.total_login_days, 0)
  INTO v_current_streak, v_total_days
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 0;
    RETURN;
  END IF;

  SELECT MAX(dl.login_date)
  INTO v_prev_claim_date
  FROM public.daily_logins dl
  WHERE dl.user_id = p_user_id
    AND dl.login_date < v_today;

  INSERT INTO public.daily_logins (user_id, login_date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, login_date) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN QUERY SELECT false, v_current_streak, v_total_days, 0;
    RETURN;
  END IF;

  SELECT (sc.value #>> '{}')
  INTO v_reward_text
  FROM public.system_config sc
  WHERE sc.key = 'mission_daily_login_reward'
  LIMIT 1;

  BEGIN
    v_reward_tokens := COALESCE(NULLIF(btrim(v_reward_text), '')::integer, 3);
  EXCEPTION WHEN OTHERS THEN
    v_reward_tokens := 3;
  END;

  IF v_reward_tokens < 0 THEN
    v_reward_tokens := 0;
  END IF;

  IF v_prev_claim_date = (v_today - INTERVAL '1 day')::date THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
  ELSE
    v_current_streak := 1;
  END IF;
  v_total_days := COALESCE(v_total_days, 0) + 1;

  -- after completing day-30 cycle, next day starts from 1
  IF v_current_streak > 30 THEN
    v_current_streak := 1;
  END IF;

  UPDATE public.profiles
  SET
    last_login_date = v_today,
    login_streak = v_current_streak,
    total_login_days = v_total_days,
    last_login = now(),
    updated_at = now()
  WHERE id = p_user_id;

  IF v_reward_tokens > 0 THEN
    PERFORM public.add_tokens(p_user_id, v_reward_tokens);
    INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, v_reward_tokens, 'complete_mission', '每日簽到獎勵');
  END IF;

  IF EXISTS (SELECT 1 FROM public.missions WHERE id = 'daily_login') THEN
    INSERT INTO public.user_missions (user_id, mission_id, completed, completed_at, last_completed_date, progress)
    VALUES (p_user_id, 'daily_login', true, now(), v_today, 100)
    ON CONFLICT (user_id, mission_id)
    DO UPDATE SET
      completed = true,
      completed_at = CASE WHEN user_missions.last_completed_date < v_today THEN now() ELSE user_missions.completed_at END,
      last_completed_date = v_today,
      progress = 100,
      updated_at = now();
  END IF;

  IF v_current_streak = 5 THEN
    INSERT INTO public.free_create_qualifications (user_id, qualification_type, source)
    VALUES (p_user_id, 'daily_login', 'consecutive_login_5');
  END IF;

  RETURN QUERY SELECT true, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

-- 5) Extend mission completion validation with repeatable missions.
CREATE OR REPLACE FUNCTION public.complete_mission_safe(p_user_id uuid, p_mission_id text)
RETURNS TABLE (success boolean, reward integer, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission RECORD;
  v_user_mission RECORD;
  v_reward integer;
  v_today date;
  v_target integer;
  v_target_text text;
  v_vote_count bigint;
  v_distinct_topics bigint;
  v_topic_count bigint;
  v_streak integer;
  v_nickname_updated_at timestamptz;
  v_streak_start date;
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, '任務不存在'::text;
    RETURN;
  END IF;

  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date;
  v_reward := COALESCE(v_mission.reward, 0);

  -- Validate mission condition before granting reward
  IF p_mission_id = 'first_vote' THEN
    SELECT (SELECT COUNT(*) FROM public.votes WHERE user_id = p_user_id) + (SELECT COUNT(*) FROM public.free_votes WHERE user_id = p_user_id) INTO v_vote_count;
    IF COALESCE(v_vote_count, 0) < 1 THEN
      RETURN QUERY SELECT false, 0, '尚未達成任務條件（需完成至少 1 次投票）'::text; RETURN;
    END IF;
  ELSIF p_mission_id = 'vote_lover' THEN
    SELECT (value #>> '{}') INTO v_target_text FROM public.system_config WHERE key = 'mission_vote_lover_target' LIMIT 1;
    v_target := COALESCE(NULLIF(TRIM(v_target_text), '')::integer, 10);
    IF v_target IS NULL OR v_target < 1 THEN v_target := 10; END IF;
    SELECT COUNT(DISTINCT topic_id) INTO v_distinct_topics
    FROM (SELECT topic_id FROM public.votes WHERE user_id = p_user_id UNION ALL SELECT topic_id FROM public.free_votes WHERE user_id = p_user_id) t;
    IF COALESCE(v_distinct_topics, 0) < v_target THEN
      RETURN QUERY SELECT false, 0, ('尚未達成任務條件（需在 ' || v_target || ' 個不同主題投票）')::text; RETURN;
    END IF;
  ELSIF p_mission_id = 'topic_creator' THEN
    SELECT COUNT(*) INTO v_topic_count FROM public.topics WHERE creator_id = p_user_id;
    IF COALESCE(v_topic_count, 0) < 1 THEN
      RETURN QUERY SELECT false, 0, '尚未達成任務條件（需發起至少 1 個主題）'::text; RETURN;
    END IF;
  ELSIF p_mission_id = 'login_7days' THEN
    SELECT (value #>> '{}') INTO v_target_text FROM public.system_config WHERE key = 'mission_7days_login_target' LIMIT 1;
    v_target := COALESCE(NULLIF(TRIM(v_target_text), '')::integer, 7);
    IF v_target IS NULL OR v_target < 1 THEN v_target := 7; END IF;
    SELECT COALESCE(login_streak, 0) INTO v_streak FROM public.profiles WHERE id = p_user_id;
    IF COALESCE(v_streak, 0) < v_target THEN
      RETURN QUERY SELECT false, 0, ('尚未達成任務條件（需連續登入 ' || v_target || ' 天）')::text; RETURN;
    END IF;
  ELSIF p_mission_id = 'nickname_editor' THEN
    SELECT nickname_updated_at INTO v_nickname_updated_at FROM public.profiles WHERE id = p_user_id;
    IF v_nickname_updated_at IS NULL THEN
      RETURN QUERY SELECT false, 0, '尚未達成任務條件（需成功修改 1 次暱稱）'::text; RETURN;
    END IF;
  ELSIF p_mission_id IN ('daily_vote_1', 'daily_vote_5', 'daily_vote_10') THEN
    IF p_mission_id = 'daily_vote_1' THEN v_target := 1;
    ELSIF p_mission_id = 'daily_vote_5' THEN v_target := 5;
    ELSE v_target := 10; END IF;
    SELECT
      (SELECT COUNT(*) FROM public.votes v WHERE v.user_id = p_user_id AND (v.created_at AT TIME ZONE 'Asia/Taipei')::date = v_today)
      + (SELECT COUNT(*) FROM public.free_votes fv WHERE fv.user_id = p_user_id AND (fv.used_at AT TIME ZONE 'Asia/Taipei')::date = v_today)
    INTO v_vote_count;
    IF COALESCE(v_vote_count, 0) < v_target THEN
      RETURN QUERY SELECT false, 0, ('尚未達成任務條件（今日需累計投票 ' || v_target || ' 票）')::text; RETURN;
    END IF;
  ELSIF p_mission_id IN ('streak_7_repeat', 'streak_14_repeat', 'streak_30_repeat') THEN
    IF p_mission_id = 'streak_7_repeat' THEN v_target := 7;
    ELSIF p_mission_id = 'streak_14_repeat' THEN v_target := 14;
    ELSE v_target := 30; END IF;
    SELECT COALESCE(login_streak, 0) INTO v_streak FROM public.profiles WHERE id = p_user_id;
    IF COALESCE(v_streak, 0) < v_target THEN
      RETURN QUERY SELECT false, 0, ('尚未達成任務條件（需連續簽到 ' || v_target || ' 天）')::text; RETURN;
    END IF;
    v_streak_start := v_today - (COALESCE(v_streak, 0) - 1);
  END IF;

  SELECT * INTO v_user_mission
  FROM public.user_missions
  WHERE user_id = p_user_id AND mission_id = p_mission_id
  FOR UPDATE;

  -- Repeatable streak missions: one claim per current streak cycle
  IF p_mission_id IN ('streak_7_repeat', 'streak_14_repeat', 'streak_30_repeat')
     AND FOUND AND v_user_mission.completed
     AND v_user_mission.last_completed_date IS NOT NULL
     AND v_user_mission.last_completed_date >= v_streak_start THEN
    RETURN QUERY SELECT false, 0, '本輪連續簽到已領取過此任務'::text;
    RETURN;
  END IF;

  IF FOUND AND v_user_mission.completed THEN
    IF v_mission.limit_per_day IS NOT NULL THEN
      IF v_user_mission.last_completed_date = v_today THEN
        RETURN QUERY SELECT false, 0, '今日任務次數已達上限'::text;
        RETURN;
      END IF;
    ELSIF p_mission_id NOT IN ('streak_7_repeat', 'streak_14_repeat', 'streak_30_repeat') THEN
      RETURN QUERY SELECT false, 0, '任務已完成'::text;
      RETURN;
    END IF;
  END IF;

  IF v_user_mission IS NULL THEN
    INSERT INTO public.user_missions (user_id, mission_id, completed, completed_at, last_completed_date, progress)
    VALUES (p_user_id, p_mission_id, true, now(), v_today, 100);
  ELSE
    UPDATE public.user_missions
    SET completed = true, completed_at = now(), last_completed_date = v_today, progress = 100, updated_at = now()
    WHERE user_id = p_user_id AND mission_id = p_mission_id;
  END IF;

  PERFORM public.add_tokens(p_user_id, v_reward);
  BEGIN
    INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, v_reward, 'complete_mission', '完成任務: ' || v_mission.name);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT true, v_reward, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.complete_mission_safe IS
'完成任務並發放代幣，支援 first_vote/vote_lover/topic_creator/login_7days/nickname_editor + daily_vote_1/5/10 + streak_7/14/30(可重複)';

GRANT EXECUTE ON FUNCTION public.complete_mission_safe(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_daily_login(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
