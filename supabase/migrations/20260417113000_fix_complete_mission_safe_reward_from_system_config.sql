-- Ensure mission reward payout always follows system_config values.
-- This fixes mismatch where UI shows updated config (e.g. 10) but payout still uses stale missions.reward (e.g. 50).

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
  v_reward_text text;
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

  -- Mission condition validation
  IF p_mission_id = 'first_vote' THEN
    SELECT (SELECT COUNT(*) FROM public.votes WHERE user_id = p_user_id)
         + (SELECT COUNT(*) FROM public.free_votes WHERE user_id = p_user_id)
    INTO v_vote_count;
    IF COALESCE(v_vote_count, 0) < 1 THEN
      RETURN QUERY SELECT false, 0, '尚未達成任務條件（需完成至少 1 次投票）'::text;
      RETURN;
    END IF;
  ELSIF p_mission_id = 'vote_lover' THEN
    SELECT (value #>> '{}') INTO v_target_text
    FROM public.system_config
    WHERE key = 'mission_vote_lover_target'
    LIMIT 1;
    v_target := COALESCE(NULLIF(TRIM(v_target_text), '')::integer, 10);
    IF v_target IS NULL OR v_target < 1 THEN v_target := 10; END IF;
    SELECT COUNT(DISTINCT topic_id) INTO v_distinct_topics
    FROM (
      SELECT topic_id FROM public.votes WHERE user_id = p_user_id
      UNION ALL
      SELECT topic_id FROM public.free_votes WHERE user_id = p_user_id
    ) t;
    IF COALESCE(v_distinct_topics, 0) < v_target THEN
      RETURN QUERY SELECT false, 0, ('尚未達成任務條件（需在 ' || v_target || ' 個不同主題投票）')::text;
      RETURN;
    END IF;
  ELSIF p_mission_id = 'topic_creator' THEN
    SELECT COUNT(*) INTO v_topic_count
    FROM public.topics
    WHERE creator_id = p_user_id;
    IF COALESCE(v_topic_count, 0) < 1 THEN
      RETURN QUERY SELECT false, 0, '尚未達成任務條件（需發起至少 1 個主題）'::text;
      RETURN;
    END IF;
  ELSIF p_mission_id = 'login_7days' THEN
    SELECT (value #>> '{}') INTO v_target_text
    FROM public.system_config
    WHERE key = 'mission_7days_login_target'
    LIMIT 1;
    v_target := COALESCE(NULLIF(TRIM(v_target_text), '')::integer, 7);
    IF v_target IS NULL OR v_target < 1 THEN v_target := 7; END IF;
    SELECT COALESCE(login_streak, 0) INTO v_streak
    FROM public.profiles
    WHERE id = p_user_id;
    IF COALESCE(v_streak, 0) < v_target THEN
      RETURN QUERY SELECT false, 0, ('尚未達成任務條件（需連續登入 ' || v_target || ' 天）')::text;
      RETURN;
    END IF;
  ELSIF p_mission_id = 'nickname_editor' THEN
    SELECT nickname_updated_at INTO v_nickname_updated_at
    FROM public.profiles
    WHERE id = p_user_id;
    IF v_nickname_updated_at IS NULL THEN
      RETURN QUERY SELECT false, 0, '尚未達成任務條件（需成功修改 1 次暱稱）'::text;
      RETURN;
    END IF;
  ELSIF p_mission_id IN ('daily_vote_1', 'daily_vote_5', 'daily_vote_10') THEN
    IF p_mission_id = 'daily_vote_1' THEN v_target := 1;
    ELSIF p_mission_id = 'daily_vote_5' THEN v_target := 5;
    ELSE v_target := 10;
    END IF;
    SELECT
      (SELECT COUNT(*) FROM public.votes v WHERE v.user_id = p_user_id AND (v.created_at AT TIME ZONE 'Asia/Taipei')::date = v_today)
      + (SELECT COUNT(*) FROM public.free_votes fv WHERE fv.user_id = p_user_id AND (fv.used_at AT TIME ZONE 'Asia/Taipei')::date = v_today)
    INTO v_vote_count;
    IF COALESCE(v_vote_count, 0) < v_target THEN
      RETURN QUERY SELECT false, 0, ('尚未達成任務條件（今日需累計投票 ' || v_target || ' 票）')::text;
      RETURN;
    END IF;
  ELSIF p_mission_id IN ('streak_7_repeat', 'streak_14_repeat', 'streak_30_repeat') THEN
    IF p_mission_id = 'streak_7_repeat' THEN v_target := 7;
    ELSIF p_mission_id = 'streak_14_repeat' THEN v_target := 14;
    ELSE v_target := 30;
    END IF;
    SELECT COALESCE(login_streak, 0) INTO v_streak
    FROM public.profiles
    WHERE id = p_user_id;
    IF COALESCE(v_streak, 0) < v_target THEN
      RETURN QUERY SELECT false, 0, ('尚未達成任務條件（需連續簽到 ' || v_target || ' 天）')::text;
      RETURN;
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

  -- Reward source of truth: system_config (fallback to missions.reward)
  SELECT (value #>> '{}') INTO v_reward_text
  FROM public.system_config
  WHERE key = CASE p_mission_id
    WHEN 'first_vote' THEN 'mission_first_vote_reward'
    WHEN 'vote_lover' THEN 'mission_vote_lover_reward'
    WHEN 'topic_creator' THEN 'mission_create_topic_reward'
    WHEN 'login_7days' THEN 'mission_7days_login_reward_tokens'
    WHEN 'nickname_editor' THEN 'mission_nickname_change_reward'
    WHEN 'daily_vote_1' THEN 'mission_daily_vote_1_reward'
    WHEN 'daily_vote_5' THEN 'mission_daily_vote_5_reward'
    WHEN 'daily_vote_10' THEN 'mission_daily_vote_10_reward'
    WHEN 'streak_7_repeat' THEN 'mission_streak_7_reward'
    WHEN 'streak_14_repeat' THEN 'mission_streak_14_reward'
    WHEN 'streak_30_repeat' THEN 'mission_streak_30_reward'
    WHEN 'daily_share_1' THEN 'mission_daily_share_reward'
    ELSE NULL
  END
  LIMIT 1;

  BEGIN
    IF v_reward_text IS NOT NULL THEN
      v_reward := COALESCE(NULLIF(TRIM(v_reward_text), '')::integer, v_reward);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Keep fallback reward from missions table when config value is malformed
    NULL;
  END;

  IF v_reward < 0 THEN
    v_reward := 0;
  END IF;

  PERFORM public.add_tokens(p_user_id, v_reward);
  BEGIN
    INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, v_reward, 'complete_mission', '完成任務: ' || v_mission.name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT true, v_reward, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.complete_mission_safe IS
'完成任務並發放代幣；獎勵優先讀取 system_config（含 first_vote / vote_lover / topic_creator / nickname / daily vote / streak / daily_share）';

NOTIFY pgrst, 'reload schema';

