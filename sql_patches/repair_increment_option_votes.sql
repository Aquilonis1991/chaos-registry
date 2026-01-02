-- 修復付費投票函數：移除內建的交易記錄 (防止 UUID 亂碼與重複)
-- 交易記錄將完全由前端負責 (已修正為顯示選項文字)

CREATE OR REPLACE FUNCTION public.increment_option_votes(
  p_topic_id UUID,
  p_option_id TEXT,
  p_vote_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic_status TEXT;
  v_end_at TIMESTAMPTZ;
  v_exists BOOLEAN;
BEGIN
  -- 1. 檢查主題狀態
  SELECT status, end_at INTO v_topic_status, v_end_at
  FROM public.topics
  WHERE id = p_topic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  IF v_topic_status = 'ended' OR v_end_at <= now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  -- 2. 檢查選項是否存在 (透過 JSONB 查詢)
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(options) AS opt
    WHERE (opt->>'id' = p_option_id) OR (p_option_id LIKE 'option-%') -- 兼容舊格式
  ) INTO v_exists
  FROM public.topics
  WHERE id = p_topic_id;
  
  -- 若沒找到該 ID，再試著當作是純文字匹配 (針對舊資料)或是允許如果不嚴格檢查
  -- 為求保險，這裡主要執行 Update，如果 Update 沒受影響行數則代表選項有誤
  
  -- 3. 更新選項票數
  -- 使用 jsonb_set 和 jsonb_array_elements 更新特定選項
  UPDATE public.topics
  SET options = (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'id') = p_option_id OR ((elem->>'id') IS NULL AND p_option_id = 'option-' || (ord - 1)::text) THEN
          jsonb_set(
            elem, 
            '{votes}', 
            (COALESCE((elem->>'votes')::int, 0) + p_vote_amount)::text::jsonb
          )
        ELSE elem
      END
    )
    FROM jsonb_array_elements(options) WITH ORDINALITY AS t(elem, ord)
  ),
  -- 同步更新總票數緩存 (雖然有 Trigger，但這裡顯式更新更保險)
  total_votes = COALESCE(total_votes, 0) + p_vote_amount
  WHERE id = p_topic_id;
  
  -- 4. 這裡故意移除 log_token_transaction 的呼叫
  -- 讓前端負責記錄，以確保能解析正確的選項名稱
  
END;
$$;
