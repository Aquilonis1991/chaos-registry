-- Add nickname edit mission and UI text keys

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nickname_updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_nickname_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nickname IS DISTINCT FROM OLD.nickname THEN
    NEW.nickname_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_nickname_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_nickname_updated_at
BEFORE UPDATE OF nickname ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_nickname_updated_at();

INSERT INTO public.system_config (key, value, category, description)
VALUES
  ('mission_nickname_change_reward', '20'::jsonb, 'mission', '修改暱稱任務獎勵代幣')
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

INSERT INTO public.missions (id, name, condition, reward, limit_per_day)
VALUES ('nickname_editor', '形象更新', '成功修改一次暱稱', 20, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  condition = EXCLUDED.condition,
  reward = COALESCE(
    (
      SELECT NULLIF(TRIM(value #>> '{}'), '')::integer
      FROM public.system_config
      WHERE key = 'mission_nickname_change_reward'
      LIMIT 1
    ),
    EXCLUDED.reward
  ),
  limit_per_day = EXCLUDED.limit_per_day;

-- Keep reward synced with config on migration run.
UPDATE public.missions
SET reward = COALESCE(
  (
    SELECT NULLIF(TRIM(value #>> '{}'), '')::integer
    FROM public.system_config
    WHERE key = 'mission_nickname_change_reward'
    LIMIT 1
  ),
  reward
)
WHERE id = 'nickname_editor';

-- UI texts for mission and nickname edit hint
INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES
  ('mission.list.5.name', '形象更新', 'mission', '任務列表：修改暱稱任務名稱', '形象更新', 'Identity Refresh', 'プロフィール更新'),
  ('mission.list.5.description', '成功修改一次暱稱', 'mission', '任務列表：修改暱稱任務說明', '成功修改一次暱稱', 'Change your nickname once', 'ニックネームを1回変更する'),
  ('mission.list.5.condition', '修改暱稱 1 次', 'mission', '任務列表：修改暱稱任務條件', '修改暱稱 1 次', 'Change nickname 1 time', 'ニックネームを1回変更する'),
  ('profile.nickname.editHint', '點擊暱稱即可編輯，輸入新名稱後按右側勾勾儲存。', 'profile', '個人頁：暱稱修改方式說明', '點擊暱稱即可編輯，輸入新名稱後按右側勾勾儲存。', 'Tap your nickname to edit it, then press the check icon to save.', 'ニックネームをタップして編集し、新しい名前を入力してチェックアイコンで保存します。')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();

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
BEGIN
  SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, '任務不存在'::text;
    RETURN;
  END IF;

  v_today := CURRENT_DATE;
  v_reward := v_mission.reward;

  -- Validate mission condition before granting reward
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
  ELSIF p_mission_id = 'nickname_editor' THEN
    SELECT nickname_updated_at INTO v_nickname_updated_at FROM public.profiles WHERE id = p_user_id;
    IF v_nickname_updated_at IS NULL THEN
      RETURN QUERY SELECT false, 0, '尚未達成任務條件（需成功修改 1 次暱稱）'::text;
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

COMMENT ON FUNCTION public.complete_mission_safe IS '完成任務並發放代幣，會驗證 first_vote/vote_lover/topic_creator/login_7days/nickname_editor 達成條件';
