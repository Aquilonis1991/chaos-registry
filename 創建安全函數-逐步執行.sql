-- ==========================================
-- 逐步創建安全函數（如果尚未創建）
-- 在 Supabase SQL Editor 執行
-- 如果某個函數已存在，會自動替換（CREATE OR REPLACE）
-- ==========================================

-- 步驟 1：創建投票函數
CREATE OR REPLACE FUNCTION public.increment_option_votes(
  p_topic_id UUID,
  p_option_id TEXT,
  p_vote_amount INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_topic_record RECORD;
  v_option_index INTEGER;
  v_updated_options JSONB;
BEGIN
  -- 獲取當前用戶 ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- 讀取主題資料
  SELECT * INTO v_topic_record
  FROM public.topics
  WHERE id = p_topic_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  -- 檢查主題是否仍活躍
  IF v_topic_record.status != 'active' THEN
    RAISE EXCEPTION 'Topic is not active';
  END IF;

  IF v_topic_record.end_at < NOW() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  -- 檢查選項是否存在
  v_option_index := -1;
  FOR i IN 0..jsonb_array_length(v_topic_record.options) - 1 LOOP
    IF (v_topic_record.options->i->>'id') = p_option_id THEN
      v_option_index := i;
      EXIT;
    END IF;
  END LOOP;

  IF v_option_index = -1 THEN
    RAISE EXCEPTION 'Option not found';
  END IF;

  -- 更新選項票數（原子操作）
  v_updated_options := jsonb_set(
    v_topic_record.options,
    ARRAY[v_option_index::text, 'votes'],
    to_jsonb((COALESCE((v_topic_record.options->v_option_index->>'votes')::INTEGER, 0) + p_vote_amount))
  );

  -- 更新主題（只有這個函數可以修改 options）
  UPDATE public.topics
  SET options = v_updated_options
  WHERE id = p_topic_id;
END;
$$;

-- 步驟 2：創建免費投票函數
CREATE OR REPLACE FUNCTION public.increment_free_vote(
  p_topic_id UUID,
  p_option_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_topic_record RECORD;
  v_option_index INTEGER;
  v_updated_options JSONB;
  v_already_used BOOLEAN;
BEGIN
  -- 獲取當前用戶 ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- 檢查今日是否已使用免費票
  SELECT EXISTS(
    SELECT 1 FROM public.free_votes
    WHERE user_id = v_user_id
      AND topic_id = p_topic_id
      AND used_at >= CURRENT_DATE
  ) INTO v_already_used;

  IF v_already_used THEN
    RAISE EXCEPTION 'Free vote already used today';
  END IF;

  -- 讀取主題資料
  SELECT * INTO v_topic_record
  FROM public.topics
  WHERE id = p_topic_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  -- 檢查主題是否仍活躍
  IF v_topic_record.status != 'active' THEN
    RAISE EXCEPTION 'Topic is not active';
  END IF;

  IF v_topic_record.end_at < NOW() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  -- 檢查選項是否存在
  v_option_index := -1;
  FOR i IN 0..jsonb_array_length(v_topic_record.options) - 1 LOOP
    IF (v_topic_record.options->i->>'id') = p_option_id THEN
      v_option_index := i;
      EXIT;
    END IF;
  END LOOP;

  IF v_option_index = -1 THEN
    RAISE EXCEPTION 'Option not found';
  END IF;

  -- 更新選項票數
  v_updated_options := jsonb_set(
    v_topic_record.options,
    ARRAY[v_option_index::text, 'votes'],
    to_jsonb((COALESCE((v_topic_record.options->v_option_index->>'votes')::INTEGER, 0) + 1))
  );

  -- 更新主題
  UPDATE public.topics
  SET options = v_updated_options
  WHERE id = p_topic_id;

  -- 記錄免費票
  INSERT INTO public.free_votes (user_id, topic_id, used_at)
  VALUES (v_user_id, p_topic_id, NOW())
  ON CONFLICT DO NOTHING;
END;
$$;

-- 步驟 3：創建警告觸發器函數
CREATE OR REPLACE FUNCTION public.warn_direct_options_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 如果 options 被直接修改（非通過安全函數），記錄警告
  IF OLD.options IS DISTINCT FROM NEW.options THEN
    RAISE WARNING 'Direct modification of options detected for topic %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 步驟 4：創建觸發器
DROP TRIGGER IF EXISTS topics_options_update_warning ON public.topics;
CREATE TRIGGER topics_options_update_warning
  BEFORE UPDATE ON public.topics
  FOR EACH ROW
  EXECUTE FUNCTION public.warn_direct_options_update();

-- 步驟 5：驗證創建結果
SELECT 
  '✅ 安全函數創建完成' as status,
  COUNT(*) FILTER (WHERE proname = 'increment_option_votes') as votes_function_exists,
  COUNT(*) FILTER (WHERE proname = 'increment_free_vote') as free_vote_function_exists,
  COUNT(*) FILTER (WHERE proname = 'warn_direct_options_update') as trigger_function_exists
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('increment_option_votes', 'increment_free_vote', 'warn_direct_options_update');

SELECT 
  '✅ 觸發器創建完成' as status,
  COUNT(*) as trigger_exists
FROM pg_trigger
WHERE tgrelid = 'public.topics'::regclass
  AND tgname = 'topics_options_update_warning';

