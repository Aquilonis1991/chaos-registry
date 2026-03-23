-- 自 20260215000000 拆分：increment_option_votes

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
  v_options JSONB;
  v_option_index INTEGER := -1;
BEGIN
  PERFORM public.check_general_rate_limit('api_general', 120);

  SELECT status, end_at, options INTO v_topic_status, v_end_at, v_options
  FROM public.topics
  WHERE id = p_topic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;
  IF v_topic_status = 'ended' OR v_end_at <= now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  FOR i IN 0..jsonb_array_length(v_options) - 1 LOOP
    IF (v_options->i->>'id') = p_option_id
       OR ((v_options->i->>'id') IS NULL AND p_option_id = 'option-' || i::text) THEN
      v_option_index := i;
      EXIT;
    END IF;
  END LOOP;
  IF v_option_index = -1 THEN
    RAISE EXCEPTION 'Option not found: %', p_option_id;
  END IF;

  UPDATE public.topics
  SET
    options = jsonb_set(
      options,
      ARRAY[v_option_index::text, 'votes'],
      to_jsonb(COALESCE((options->v_option_index->>'votes')::INTEGER, 0) + p_vote_amount)
    ),
    total_votes = COALESCE(total_votes, 0) + p_vote_amount
  WHERE id = p_topic_id;
END;
$$;
