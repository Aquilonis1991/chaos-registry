-- Restore /rpc/decay_arena_ttl endpoint visibility for PostgREST.
-- This migration focuses on fixing HTTP 404 on /rest/v1/rpc/decay_arena_ttl.
--
-- Notes:
-- 1) Recreates public.decay_arena_ttl(p_minutes integer default 1)
-- 2) Adds a zero-arg overload for compatibility
-- 3) Grants execute to authenticated + service_role
-- 4) Triggers PostgREST schema reload

CREATE OR REPLACE FUNCTION public.decay_arena_ttl(p_minutes INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decay_rate INTEGER := 1;
  v_deduction INTEGER := 0;
  v_updated INTEGER := 0;
  v_recycled INTEGER := 0;
  v_has_recycled_at BOOLEAN := false;
BEGIN
  SELECT COALESCE((value #>> '{}')::INT, 1)
  INTO v_decay_rate
  FROM public.system_config
  WHERE key = 'arena_natural_decay_rate'
  LIMIT 1;

  v_deduction := GREATEST(0, LEAST(COALESCE(p_minutes, 1), 60) * v_decay_rate);

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'topic_arena_messages'
      AND column_name = 'recycled_at'
  )
  INTO v_has_recycled_at;

  WITH active_topics AS (
    SELECT id
    FROM public.topics
    WHERE status != 'ended' AND end_at > now()
  ),
  decayed AS (
    UPDATE public.topic_arena_messages m
    SET ttl_minutes = GREATEST(0, m.ttl_minutes - v_deduction),
        updated_at = now()
    FROM active_topics t
    WHERE m.topic_id = t.id
      AND m.is_legacy = false
      AND (m.shield_until IS NULL OR m.shield_until <= now())
      AND (NOT v_has_recycled_at OR m.recycled_at IS NULL)
    RETURNING m.id
  )
  SELECT COUNT(*) INTO v_updated FROM decayed;

  IF v_has_recycled_at THEN
    WITH active_topics AS (
      SELECT id
      FROM public.topics
      WHERE status != 'ended' AND end_at > now()
    ),
    recycled AS (
      UPDATE public.topic_arena_messages m
      SET recycled_at = now(),
          ttl_minutes = 0,
          updated_at = now()
      FROM active_topics t
      WHERE m.topic_id = t.id
        AND m.is_legacy = false
        AND m.recycled_at IS NULL
        AND m.ttl_minutes <= 0
      RETURNING m.id
    )
    SELECT COUNT(*) INTO v_recycled FROM recycled;
  ELSE
    WITH active_topics AS (
      SELECT id
      FROM public.topics
      WHERE status != 'ended' AND end_at > now()
    ),
    removed AS (
      DELETE FROM public.topic_arena_messages m
      USING active_topics t
      WHERE m.topic_id = t.id
        AND m.is_legacy = false
        AND m.ttl_minutes <= 0
      RETURNING m.id
    )
    SELECT COUNT(*) INTO v_recycled FROM removed;
  END IF;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'recycled', v_recycled,
    'mode', CASE WHEN v_has_recycled_at THEN 'soft_recycle' ELSE 'delete' END
  );
END;
$$;

-- Compatibility overload: allows calling /rpc/decay_arena_ttl with empty body.
CREATE OR REPLACE FUNCTION public.decay_arena_ttl()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.decay_arena_ttl(1);
$$;

GRANT EXECUTE ON FUNCTION public.decay_arena_ttl(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decay_arena_ttl(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.decay_arena_ttl() TO authenticated;
GRANT EXECUTE ON FUNCTION public.decay_arena_ttl() TO service_role;

NOTIFY pgrst, 'reload schema';
