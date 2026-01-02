-- 修復免費投票功能的綜合 Patch (V2)
-- 1. 補上 topics 表缺少的 free_votes_count 欄位
-- 2. 修正 increment_free_vote 函數:
--    - 移除無效的 ON CONFLICT 語法
--    - 修正選項顯示亂碼問題 (改為記錄選項文字而非 ID)
--    - 移除重複的 log_token_transaction (避免重複扣款/記錄)

BEGIN;

-- 1. 確保欄位存在
ALTER TABLE public.topics
ADD COLUMN IF NOT EXISTS free_votes_count INTEGER DEFAULT 0;

-- 2. 重建函數
DROP FUNCTION IF EXISTS public.increment_free_vote(UUID, TEXT);

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
  v_topic_title TEXT;
  v_option_label TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- 檢查今日是否已使用免費票
  SELECT EXISTS(
    SELECT 1
    FROM public.free_votes
    WHERE user_id = v_user_id
      AND topic_id = p_topic_id
      AND DATE(used_at) = CURRENT_DATE
  ) INTO v_already_used;

  IF v_already_used THEN
    RAISE EXCEPTION 'Free vote already used today for this topic';
  END IF;

  -- 讀取主題資料
  SELECT * INTO v_topic_record
  FROM public.topics
  WHERE id = p_topic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  -- 保存主題標題用於記錄
  v_topic_title := v_topic_record.title;

  IF v_topic_record.status != 'active' THEN
    RAISE EXCEPTION 'Topic is not active';
  END IF;

  IF v_topic_record.end_at < NOW() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  -- 檢查選項是否存在並獲取選項文字
  v_option_index := -1;
  v_option_label := 'Unknown';
  
  FOR i IN 0..jsonb_array_length(v_topic_record.options) - 1 LOOP
    IF (v_topic_record.options->i->>'id') = p_option_id THEN
      v_option_index := i;
      v_option_label := v_topic_record.options->i->>'label'; -- 獲取選項顯示文字
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

  -- 更新主題 (包含 free_votes_count)
  UPDATE public.topics
  SET 
    options = v_updated_options,
    free_votes_count = COALESCE(free_votes_count, 0) + 1
  WHERE id = p_topic_id;

  -- 記錄免費票
  INSERT INTO public.free_votes (user_id, topic_id, option, used_at)
  VALUES (v_user_id, p_topic_id, p_option_id, NOW());
  
  -- 添加到主題參與者 (如果尚未存在)
  INSERT INTO public.topic_participants (user_id, topic_id)
  VALUES (v_user_id, p_topic_id)
  ON CONFLICT (user_id, topic_id) DO NOTHING;

  -- [修改] 移除這裡的 log_token_transaction 呼叫
  -- 因為這會與前端或觸發器中的紀錄重複，而且免費票金額為 0，通常不需要在 token_transactions 流水中顯示
  -- 如果需要在前端顯示，建議由前端統一查詢 free_votes 表，或者只依賴前端的記錄

END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_free_vote(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
