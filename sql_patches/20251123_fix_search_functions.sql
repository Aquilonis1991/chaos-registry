BEGIN;

-- 先刪除舊函數以避免 signature 衝突
DROP FUNCTION IF EXISTS public.search_topics(TEXT, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.search_topic_suggestions(TEXT, INTEGER);

-- 修正 search_topics：確保回傳類型符合定義，特別是 total_votes 為 INTEGER
CREATE OR REPLACE FUNCTION public.search_topics(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_sort TEXT DEFAULT 'relevance'
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  tags TEXT[],
  creator_id UUID,
  creator_name TEXT,
  creator_avatar TEXT,
  created_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT,
  exposure_level TEXT,
  total_votes INTEGER,
  match_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT := LOWER(TRIM(COALESCE(p_query, '')));
  v_pattern TEXT := '%' || v_query || '%';
  v_sort TEXT := LOWER(COALESCE(p_sort, 'relevance'));
  v_grace_days INTEGER := COALESCE(
    (SELECT value::INTEGER FROM public.system_config WHERE key = 'home_expired_topic_grace_days'),
    0
  );
BEGIN
  IF v_query = '' THEN
    RETURN;
  END IF;

  IF v_sort NOT IN ('hot', 'latest', 'relevance') THEN
    v_sort := 'relevance';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      t.*,
      CASE
        WHEN LOWER(t.title) LIKE v_pattern THEN 'title'
        WHEN EXISTS (
          SELECT 1 FROM unnest(t.tags) tag
          WHERE LOWER(tag) LIKE v_pattern
        ) THEN 'tag'
        ELSE 'description'
      END AS match_type,
      CASE
        WHEN LOWER(t.title) LIKE v_pattern THEN 0
        WHEN EXISTS (
          SELECT 1 FROM unnest(t.tags) tag
          WHERE LOWER(tag) LIKE v_pattern
        ) THEN 1
        ELSE 2
      END AS relevance_rank,
      COALESCE(
        (
          SELECT SUM(COALESCE((option_item ->> 'votes')::INT, 0))
          FROM jsonb_array_elements(COALESCE(t.options, '[]'::jsonb)) option_item
        ),
        0
      )::INTEGER AS total_votes
    FROM public.topics t
    WHERE t.status = 'active'
      AND (t.is_hidden IS NULL OR t.is_hidden = FALSE)
      AND t.end_at >= (NOW() - make_interval(days => v_grace_days))
      AND (
        LOWER(t.title) LIKE v_pattern OR
        LOWER(COALESCE(t.description, '')) LIKE v_pattern OR
        EXISTS (
          SELECT 1 FROM unnest(t.tags) tag
          WHERE LOWER(tag) LIKE v_pattern
        )
      )
  )
  SELECT
    f.id,
    f.title,
    f.description,
    f.tags,
    f.creator_id,
    p.nickname AS creator_name,
    p.avatar AS creator_avatar,
    f.created_at,
    f.end_at,
    f.status,
    f.exposure_level,
    f.total_votes,
    f.match_type
  FROM filtered f
  LEFT JOIN public.profiles p ON p.id = f.creator_id
  ORDER BY
    CASE
      WHEN v_sort = 'hot' THEN 0
      WHEN v_sort = 'latest' THEN 1
      ELSE 2
    END,
    CASE
      WHEN v_sort = 'hot' THEN f.total_votes
      WHEN v_sort = 'latest' THEN EXTRACT(EPOCH FROM f.created_at)
      ELSE -f.relevance_rank
    END DESC,
    f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 修正 search_topic_suggestions：在結果集中包含排序欄位
CREATE OR REPLACE FUNCTION public.search_topic_suggestions(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  suggestion_type TEXT,
  suggestion_text TEXT,
  topic_id UUID,
  priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT := LOWER(TRIM(COALESCE(p_query, '')));
  v_pattern TEXT := '%' || v_query || '%';
BEGIN
  IF v_query = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH topic_matches AS (
    SELECT
      t.id,
      t.title,
      0 AS priority
    FROM public.topics t
    WHERE t.status = 'active'
      AND (t.is_hidden IS NULL OR t.is_hidden = FALSE)
      AND LOWER(t.title) LIKE v_pattern
    ORDER BY t.created_at DESC
    LIMIT p_limit
  ),
  tag_matches AS (
    SELECT DISTINCT
      INITCAP(tag) AS display_tag,
      LOWER(tag) AS normalized_tag,
      1 AS priority
    FROM public.topics t
    CROSS JOIN LATERAL unnest(t.tags) tag
    WHERE LOWER(tag) LIKE v_pattern
    ORDER BY normalized_tag ASC
    LIMIT p_limit
  )
  SELECT 'topic' AS suggestion_type, tm.title AS suggestion_text, tm.id AS topic_id, tm.priority
  FROM topic_matches tm
  UNION ALL
  SELECT 'tag' AS suggestion_type, tg.display_tag AS suggestion_text, NULL::UUID AS topic_id, tg.priority
  FROM tag_matches tg
  ORDER BY priority, suggestion_text
  LIMIT p_limit;
END;
$$;

COMMIT;

