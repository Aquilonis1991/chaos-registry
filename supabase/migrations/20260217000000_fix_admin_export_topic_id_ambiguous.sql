-- 修復 admin_export_topic_stats_v2 中 "column reference topic_id is ambiguous" 錯誤
-- 子查詢內與 JOIN 條件中的 topic_id 改為明確指定表別名，避免歧義

CREATE OR REPLACE FUNCTION public.admin_export_topic_stats_v2(
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL
)
RETURNS TABLE (
  topic_id UUID,
  created_at TIMESTAMPTZ,
  title TEXT,
  status TEXT,
  total_votes INTEGER,
  topic_unique_voters BIGINT,
  option_label TEXT,
  option_votes INTEGER,
  option_free_unique_voters BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  BEGIN
    IF p_start_date IS NOT NULL THEN v_start := p_start_date::TIMESTAMPTZ; END IF;
    IF p_end_date IS NOT NULL THEN v_end := p_end_date::TIMESTAMPTZ; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_start := NULL;
    v_end := NULL;
  END;

  RETURN QUERY
  SELECT
    t.id AS topic_id,
    t.created_at,
    t.title,
    t.status,
    COALESCE(t.total_votes, 0) AS total_votes,
    COALESCE(tp.unique_count, 0) AS topic_unique_voters,
    opt.value->>'label' AS option_label,
    (opt.value->>'votes')::INTEGER AS option_votes,
    COALESCE(fv.unique_count, 0) AS option_free_unique_voters
  FROM public.topics t
  CROSS JOIN LATERAL jsonb_array_elements(t.options) AS opt
  LEFT JOIN (
    SELECT tp_inner.topic_id AS topic_id, COUNT(*) AS unique_count
    FROM public.topic_participants tp_inner
    GROUP BY tp_inner.topic_id
  ) tp ON tp.topic_id = t.id
  LEFT JOIN (
    SELECT fv_inner.topic_id AS topic_id, fv_inner.option AS option_id, COUNT(DISTINCT fv_inner.user_id) AS unique_count
    FROM public.free_votes fv_inner
    GROUP BY fv_inner.topic_id, fv_inner.option
  ) fv ON fv.topic_id = t.id AND fv.option_id = (opt.value->>'id')
  WHERE
    (v_start IS NULL OR t.created_at >= v_start)
    AND (v_end IS NULL OR t.created_at <= v_end)
  ORDER BY t.created_at DESC, t.title, opt.value->>'label';
END;
$$;
