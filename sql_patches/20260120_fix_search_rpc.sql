-- Create search_topics function
CREATE OR REPLACE FUNCTION search_topics(
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_sort TEXT DEFAULT 'relevance'
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  tags TEXT[],
  creator_id UUID,
  created_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT,
  total_votes BIGINT,
  exposure_level TEXT,
  creator_name TEXT,
  creator_avatar TEXT,
  match_type TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.tags,
    t.creator_id,
    t.created_at,
    t.end_at,
    t.status,
    t.total_votes,
    t.exposure_level,
    p.nickname as creator_name,
    p.avatar as creator_avatar,
    CASE
      WHEN t.title ILIKE '%' || p_query || '%' THEN 'title'
      WHEN EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE tag ILIKE '%' || p_query || '%') THEN 'tag'
      ELSE 'description'
    END as match_type
  FROM topics t
  LEFT JOIN profiles p ON t.creator_id = p.id
  WHERE
    (t.title ILIKE '%' || p_query || '%'
    OR t.description ILIKE '%' || p_query || '%'
    OR EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE tag ILIKE '%' || p_query || '%'))
    AND t.status IN ('active', 'completed') -- Include active and completed
  ORDER BY
    CASE WHEN p_sort = 'hot' THEN t.total_votes END DESC,
    CASE WHEN p_sort = 'latest' THEN t.created_at END DESC,
    CASE WHEN p_sort = 'relevance' THEN
      (CASE
        WHEN t.title ILIKE '%' || p_query || '%' THEN 1
        WHEN EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE tag ILIKE '%' || p_query || '%') THEN 2
        ELSE 3
      END)
    END ASC,
    t.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
