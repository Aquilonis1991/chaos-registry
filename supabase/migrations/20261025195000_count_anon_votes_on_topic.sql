-- 匿名票寫進 topics.options.votes，讓網頁和 App 用同一組票數。

CREATE OR REPLACE FUNCTION public.add_topic_option_votes(
  p_topic_id uuid,
  p_option_id text,
  p_amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_options jsonb;
  v_option_index integer := -1;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN
    RETURN;
  END IF;

  SELECT options INTO v_options
  FROM public.topics
  WHERE id = p_topic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
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
      to_jsonb(COALESCE((options->v_option_index->>'votes')::integer, 0) + p_amount)
    ),
    total_votes = COALESCE(total_votes, 0) + p_amount
  WHERE id = p_topic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_topic_option_votes(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_topic_option_votes(uuid, text, integer) TO service_role;

ALTER TABLE public.anon_votes
  ADD COLUMN IF NOT EXISTS counted_in_topic boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT topic_id, option_id, COUNT(*)::integer AS n
    FROM public.anon_votes
    WHERE NOT counted_in_topic
    GROUP BY topic_id, option_id
  LOOP
    BEGIN
      PERFORM public.add_topic_option_votes(r.topic_id, r.option_id, r.n);
      UPDATE public.anon_votes
      SET counted_in_topic = true
      WHERE topic_id = r.topic_id
        AND option_id = r.option_id
        AND NOT counted_in_topic;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'anon vote backfill skipped for % / %: %', r.topic_id, r.option_id, SQLERRM;
    END;
  END LOOP;
END $$;
