-- free_votes 表使用欄位 "option" 而非 "option_id"，修正 increment_free_vote 的 INSERT
CREATE OR REPLACE FUNCTION public.increment_free_vote(
  p_topic_id UUID,
  p_option_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_topic_record RECORD;
  v_option_index INTEGER := -1;
  v_already_used BOOLEAN;
BEGIN
  PERFORM public.check_general_rate_limit('api_general', 120);

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.free_votes
    WHERE user_id = v_user_id AND topic_id = p_topic_id AND used_at >= CURRENT_DATE
  ) INTO v_already_used;
  IF v_already_used THEN
    RAISE EXCEPTION 'Free vote already used today';
  END IF;

  SELECT * INTO v_topic_record FROM public.topics WHERE id = p_topic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Topic not found'; END IF;
  IF v_topic_record.status != 'active' OR v_topic_record.end_at < NOW() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  FOR i IN 0..jsonb_array_length(v_topic_record.options) - 1 LOOP
    IF (v_topic_record.options->i->>'id') = p_option_id
       OR ((v_topic_record.options->i->>'id') IS NULL AND p_option_id = 'option-' || i::text) THEN
      v_option_index := i;
      EXIT;
    END IF;
  END LOOP;
  IF v_option_index = -1 THEN RAISE EXCEPTION 'Option not found: %', p_option_id; END IF;

  UPDATE public.topics
  SET
    options = jsonb_set(
      options,
      ARRAY[v_option_index::text, 'votes'],
      to_jsonb(COALESCE((options->v_option_index->>'votes')::INTEGER, 0) + 1)
    ),
    total_votes = COALESCE(total_votes, 0) + 1
  WHERE id = p_topic_id;

  INSERT INTO public.free_votes (user_id, topic_id, option, used_at)
  VALUES (v_user_id, p_topic_id, p_option_id, NOW());
END;
$$;
