-- 觀點角鬥場：話題結束時 Purge + 標記 is_legacy
CREATE OR REPLACE FUNCTION public.purge_arena_on_topic_end(p_topic_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_throne_x INTEGER;
  v_elite_y INTEGER;
  v_legacy_count INTEGER;
  v_purged_count INTEGER;
BEGIN
  SELECT COALESCE((value #>> '{}')::INT, 100) INTO v_throne_x
  FROM public.system_config WHERE key = 'arena_throne_min_threshold_x' LIMIT 1;
  SELECT COALESCE((value #>> '{}')::INT, 50) INTO v_elite_y
  FROM public.system_config WHERE key = 'arena_elite_min_threshold_y' LIMIT 1;

  WITH ranked AS (
    SELECT id, (upvote_count - downvote_count) AS net,
      row_number() OVER (ORDER BY (upvote_count - downvote_count) DESC, created_at ASC) AS rn
    FROM public.topic_arena_messages
    WHERE topic_id = p_topic_id
  ),
  survivors AS (
    SELECT id FROM ranked
    WHERE (rn = 1 AND net >= v_throne_x) OR (rn <= 4 AND net >= v_elite_y AND rn > 1)
  )
  UPDATE public.topic_arena_messages
  SET is_legacy = true, ttl_minutes = 0, updated_at = now()
  WHERE id IN (SELECT id FROM survivors);
  GET DIAGNOSTICS v_legacy_count = ROW_COUNT;

  DELETE FROM public.topic_arena_messages
  WHERE topic_id = p_topic_id AND is_legacy = false;
  GET DIAGNOSTICS v_purged_count = ROW_COUNT;

  RETURN jsonb_build_object('legacy_count', v_legacy_count, 'purged_count', v_purged_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_arena_on_topic_end(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_arena_on_topic_end(UUID) TO service_role;
NOTIFY pgrst, 'reload schema';
