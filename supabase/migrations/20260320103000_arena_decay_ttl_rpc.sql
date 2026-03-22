-- 觀點角鬥場：decay_arena_ttl 定時衰減（排程呼叫）
CREATE OR REPLACE FUNCTION public.decay_arena_ttl(p_minutes INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decay_rate INTEGER;
  v_deduction INTEGER;
  v_updated INTEGER;
  v_purged INTEGER;
BEGIN
  SELECT COALESCE((value #>> '{}')::INT, 1) INTO v_decay_rate
  FROM public.system_config WHERE key = 'arena_natural_decay_rate' LIMIT 1;

  v_deduction := least(p_minutes, 60) * v_decay_rate;

  WITH active_topics AS (
    SELECT id FROM public.topics
    WHERE status != 'ended' AND end_at > now()
  ),
  decayed AS (
    UPDATE public.topic_arena_messages m
    SET ttl_minutes = greatest(0, m.ttl_minutes - v_deduction), updated_at = now()
    FROM active_topics t
    WHERE m.topic_id = t.id
      AND m.is_legacy = false
      AND (m.shield_until IS NULL OR m.shield_until <= now())
    RETURNING m.id
  )
  SELECT COUNT(*) INTO v_updated FROM decayed;

  WITH purged AS (
    DELETE FROM public.topic_arena_messages
    WHERE topic_id IN (SELECT id FROM public.topics WHERE status != 'ended' AND end_at > now())
      AND is_legacy = false
      AND ttl_minutes <= 0
    RETURNING id
  )
  SELECT COUNT(*) INTO v_purged FROM purged;

  RETURN jsonb_build_object('updated', v_updated, 'purged', v_purged);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decay_arena_ttl(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decay_arena_ttl(INTEGER) TO service_role;
NOTIFY pgrst, 'reload schema';
