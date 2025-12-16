-- 確保免費投票會完整記錄在 free_votes 表與歷史清單中

-- 1. free_votes 表補上 option 欄位（若尚未存在），並確保為 NOT NULL
ALTER TABLE public.free_votes
  ADD COLUMN IF NOT EXISTS option TEXT;

UPDATE public.free_votes
SET option = COALESCE(option, 'unknown')
WHERE option IS NULL;

ALTER TABLE public.free_votes
  ALTER COLUMN option SET NOT NULL;

-- 2. 重新建立 increment_free_vote 函數，確保寫入 option 與一致性檢查
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
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.free_votes
    WHERE user_id = v_user_id
      AND topic_id = p_topic_id
      AND used_at >= date_trunc('day', now())
  ) INTO v_already_used;

  IF v_already_used THEN
    RAISE EXCEPTION 'Free vote already used today';
  END IF;

  SELECT *
  INTO v_topic_record
  FROM public.topics
  WHERE id = p_topic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  IF v_topic_record.status <> 'active' THEN
    RAISE EXCEPTION 'Topic is not active';
  END IF;

  IF v_topic_record.end_at < now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

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

  v_updated_options := jsonb_set(
    v_topic_record.options,
    ARRAY[v_option_index::text, 'votes'],
    to_jsonb(
      COALESCE(
        (v_topic_record.options->v_option_index->>'votes')::INTEGER,
        0
      ) + 1
    )
  );

  UPDATE public.topics
  SET 
    options = v_updated_options,
    free_votes_count = COALESCE(free_votes_count, 0) + 1
  WHERE id = p_topic_id;

  INSERT INTO public.free_votes (user_id, topic_id, option, used_at)
  VALUES (v_user_id, p_topic_id, p_option_id, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_free_vote(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';





