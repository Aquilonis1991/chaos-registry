-- 確保所有任務可正常完成且正確發送代幣
-- 1) 補齊 first_vote 任務（若不存在）
-- 2) record_daily_login 改從 system_config 讀取每日獎勵
-- 3) complete_mission_safe 增加達成條件驗證，防止未達標即領取

-- 1) 補齊 first_vote 任務
INSERT INTO public.missions (id, name, condition, reward, limit_per_day)
VALUES ('first_vote', '新手上路', '完成第一次投票', 50, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  condition = EXCLUDED.condition,
  reward = EXCLUDED.reward,
  limit_per_day = EXCLUDED.limit_per_day;

-- 2) record_daily_login：從 system_config 讀取每日簽到獎勵（mission_daily_login_reward），預設 3
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
  v_reward_tokens INTEGER := 3;
  v_today DATE;
  v_old_token_balance INTEGER;
  v_new_token_balance INTEGER;
  v_config_reward TEXT;
BEGIN
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE;

  SELECT last_login_date, login_streak, total_login_days
  INTO v_last_login_date, v_current_streak, v_total_days
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_last_login_date = v_today THEN
    RETURN QUERY SELECT false, COALESCE(v_current_streak, 0), COALESCE(v_total_days, 0), 0;
    RETURN;
  END IF;

  v_is_new_login := true;
  v_total_days := COALESCE(v_total_days, 0) + 1;

  IF v_last_login_date = v_today - INTERVAL '1 day' THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
  ELSIF v_last_login_date IS NULL THEN
    v_current_streak := 1;
  ELSE
    v_current_streak := 1;
  END IF;

  -- 從 system_config 讀取每日簽到獎勵，無則預設 3
  SELECT (value #>> '{}') INTO v_config_reward FROM public.system_config WHERE key = 'mission_daily_login_reward' LIMIT 1;
  BEGIN
    v_reward_tokens := COALESCE(TRIM(v_config_reward), '')::integer;
  EXCEPTION WHEN OTHERS THEN
    v_reward_tokens := 3;
  END;
  IF v_reward_tokens IS NULL OR v_reward_tokens < 0 THEN
    v_reward_tokens := 3;
  END IF;

  INSERT INTO public.daily_logins (user_id, login_date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id, login_date) DO NOTHING;

  UPDATE public.profiles
  SET last_login_date = v_today, login_streak = v_current_streak, total_login_days = v_total_days, last_login = now()
  WHERE id = p_user_id;

  SELECT COALESCE(p.tokens, 0) INTO v_old_token_balance FROM public.profiles p WHERE p.id = p_user_id;
  PERFORM public.add_tokens(p_user_id, v_reward_tokens);
  SELECT COALESCE(p.tokens, 0) INTO v_new_token_balance FROM public.profiles p WHERE p.id = p_user_id;

  INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, v_reward_tokens, 'complete_mission', '每日登入獎勵');

  IF EXISTS (SELECT 1 FROM public.missions WHERE id = 'daily_login') THEN
    INSERT INTO public.user_missions (user_id, mission_id, completed, completed_at, last_completed_date, progress)
    VALUES (p_user_id, 'daily_login', true, now(), v_today, 100)
    ON CONFLICT (user_id, mission_id)
    DO UPDATE SET completed = true, completed_at = CASE WHEN user_missions.last_completed_date < v_today THEN now() ELSE user_missions.completed_at END,
      last_completed_date = v_today, progress = 100, updated_at = now();
  END IF;

  IF v_current_streak = 5 THEN
    INSERT INTO public.free_create_qualifications (user_id, source, description)
    VALUES (p_user_id, 'consecutive_login_5', '連續登入5天獎勵')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_is_new_login, v_current_streak, v_total_days, v_reward_tokens;
END;
$$;

-- 3) complete_mission_safe：增加達成條件驗證
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
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, '任務不存在'::text;
    RETURN;
  END IF;

  v_today := CURRENT_DATE;
  v_reward := v_mission.reward;

  -- 驗證達成條件（未達標不發獎）
  IF p_mission_id = 'first_vote' THEN
    SELECT (SELECT COUNT(*) FROM public.votes WHERE user_id = p_user_id) + (SELECT COUNT(*) FROM public.free_votes WHERE user_id = p_user_id) INTO v_vote_count;
    IF COALESCE(v_vote_count, 0) < 1 THEN
      RETURN QUERY SELECT false, 0, '尚未達成任務條件（需完成至少 1 次投票）'::text;
      RETURN;
    END IF;
  ELSIF p_mission_id = 'vote_lover' THEN
    SELECT (value #>> '{}') INTO v_target_text FROM public.system_config WHERE key = 'mission_vote_lover_target' LIMIT 1;
    v_target := COALESCE(NULLIF(TRIM(v_target_text), '')::integer, 10);
    IF v_target IS NULL OR v_target < 1 THEN v_target := 10; END IF;
    SELECT COUNT(DISTINCT topic_id) INTO v_distinct_topics
    FROM (SELECT topic_id FROM public.votes WHERE user_id = p_user_id UNION ALL SELECT topic_id FROM public.free_votes WHERE user_id = p_user_id) t;
    IF COALESCE(v_distinct_topics, 0) < v_target THEN
      RETURN QUERY SELECT false, 0, ('尚未達成任務條件（需在 ' || v_target || ' 個不同主題投票）')::text;
      RETURN;
    END IF;
  ELSIF p_mission_id = 'topic_creator' THEN
    SELECT COUNT(*) INTO v_topic_count FROM public.topics WHERE creator_id = p_user_id;
    IF COALESCE(v_topic_count, 0) < 1 THEN
      RETURN QUERY SELECT false, 0, '尚未達成任務條件（需發起至少 1 個主題）'::text;
      RETURN;
    END IF;
  ELSIF p_mission_id = 'login_7days' THEN
    SELECT (value #>> '{}') INTO v_target_text FROM public.system_config WHERE key = 'mission_7days_login_target' LIMIT 1;
    v_target := COALESCE(NULLIF(TRIM(v_target_text), '')::integer, 7);
    IF v_target IS NULL OR v_target < 1 THEN v_target := 7; END IF;
    SELECT COALESCE(login_streak, 0) INTO v_streak FROM public.profiles WHERE id = p_user_id;
    IF COALESCE(v_streak, 0) < v_target THEN
      RETURN QUERY SELECT false, 0, ('尚未達成任務條件（需連續登入 ' || v_target || ' 天）')::text;
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_user_mission
  FROM public.user_missions
  WHERE user_id = p_user_id AND mission_id = p_mission_id
  FOR UPDATE;

  IF FOUND AND v_user_mission.completed THEN
    IF v_mission.limit_per_day IS NOT NULL THEN
      IF v_user_mission.last_completed_date = v_today THEN
        RETURN QUERY SELECT false, 0, '今日任務次數已達上限'::text;
        RETURN;
      END IF;
    ELSE
      RETURN QUERY SELECT false, 0, '任務已完成'::text;
      RETURN;
    END IF;
  END IF;

  IF v_user_mission IS NULL THEN
    INSERT INTO public.user_missions (user_id, mission_id, completed, completed_at, last_completed_date, progress)
    VALUES (p_user_id, p_mission_id, true, now(), v_today, 100);
  ELSIF NOT v_user_mission.completed OR (v_mission.limit_per_day IS NOT NULL AND v_user_mission.last_completed_date < v_today) THEN
    UPDATE public.user_missions
    SET completed = true, completed_at = now(), last_completed_date = v_today, progress = 100, updated_at = now()
    WHERE user_id = p_user_id AND mission_id = p_mission_id
      AND (completed = false OR (v_mission.limit_per_day IS NOT NULL AND last_completed_date < v_today));
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 0, '任務已完成'::text;
      RETURN;
    END IF;
  ELSE
    RETURN QUERY SELECT false, 0, '任務已完成'::text;
    RETURN;
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

COMMENT ON FUNCTION public.record_daily_login IS '記錄每日登入，獎勵從 system_config.mission_daily_login_reward 讀取，完成 daily_login 任務';
COMMENT ON FUNCTION public.complete_mission_safe IS '完成任務並發放代幣，會驗證 first_vote/vote_lover/topic_creator/login_7days 達成條件';
