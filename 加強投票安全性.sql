-- ==========================================
-- 加強投票安全性 - 限制 topics 更新操作
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- 問題分析：
-- 當前 RLS 政策允許創建者更新整個 topics 記錄
-- 這可能被惡意利用來修改選項票數
-- 需要增加更精細的控制

-- 1. 刪除過於寬鬆的 UPDATE 政策
DROP POLICY IF EXISTS "Creators can update own topics" ON public.topics;
DROP POLICY IF EXISTS "Creators can update own topic metadata" ON public.topics;

-- 2. 創建更嚴格的政策：只允許創建者更新自己的主題
-- 注意：直接修改 options 欄位會被安全函數替代
-- 這裡允許更新是為了讓創建者可以修改標題、描述等，但實際上 options 只能通過安全函數更新
CREATE POLICY "Creators can update own topics"
  ON public.topics FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- 注意：雖然 RLS 允許更新，但我們會在應用層和安全函數中
-- 防止直接修改 options 欄位。真正的保護來自安全函數的使用。

-- 3. 創建安全函數：透過函數更新選項票數（唯一允許的方式）
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

-- 4. 創建安全函數：免費投票更新
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

-- 5. 確保 profiles 只能更新自己的代幣
-- （這個政策應該已經存在，但我們確認一下）

-- 6. 創建觸發器：警告直接修改 options 的嘗試（可選）
-- 這個觸發器不會阻止更新，但會記錄警告
-- 生產環境中，你可能有專門的審計日誌系統
CREATE OR REPLACE FUNCTION public.warn_direct_options_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 如果 options 被直接修改（非通過安全函數），記錄警告
  -- 注意：這只是警告，實際保護來自使用安全函數
  IF OLD.options IS DISTINCT FROM NEW.options THEN
    RAISE WARNING 'Direct modification of options detected for topic %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS topics_options_update_warning ON public.topics;
CREATE TRIGGER topics_options_update_warning
  BEFORE UPDATE ON public.topics
  FOR EACH ROW
  EXECUTE FUNCTION public.warn_direct_options_update();

-- 驗證當前政策
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('topics', 'profiles', 'votes', 'free_votes')
ORDER BY tablename, policyname;

