-- Implement search_topics RPC for fuzzy search
-- This function allows searching topics by title, description, or tags

DROP FUNCTION IF EXISTS search_topics(TEXT, INTEGER, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION search_topics(
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
  created_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  options JSONB,
  total_votes BIGINT,
  creator_name TEXT,
  creator_avatar TEXT,
  match_type TEXT,
  exposure_level TEXT
) 
SECURITY DEFINER -- IMPORTANT: Bypass RLS
SET search_path = public, extensions -- Secure search path
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.tags::text[], -- Explicit cast to enforce TEXT[]
    t.options::jsonb,
    (SELECT COALESCE(SUM(amount), 0) FROM votes v WHERE v.topic_id = t.id) AS total_votes, -- Calculate votes dynamically
    COALESCE(p.nickname, 'Unknown') AS creator_name,
    COALESCE(p.avatar, '👤') AS creator_avatar,
    CASE
      WHEN t.title ILIKE '%' || p_query || '%' THEN 'title'
      WHEN EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE tag ILIKE '%' || p_query || '%') THEN 'tag'
      ELSE 'description'
    END AS match_type,
    t.exposure_level
  FROM topics t
  LEFT JOIN profiles p ON t.creator_id = p.id -- FIXED: created_by -> creator_id
  WHERE
    t.status != 'deleted'
    AND (
      t.title ILIKE '%' || p_query || '%'
      OR t.description ILIKE '%' || p_query || '%'
      OR EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE tag ILIKE '%' || p_query || '%')
    )
  ORDER BY
    CASE WHEN p_sort = 'relevance' THEN
      (CASE
        WHEN t.title ILIKE '%' || p_query || '%' THEN 1
        WHEN EXISTS (SELECT 1 FROM unnest(t.tags) tag WHERE tag ILIKE '%' || p_query || '%') THEN 2
        ELSE 3
      END)
    END ASC,
    CASE WHEN p_sort = 'hot' THEN t.total_votes END DESC,
    CASE WHEN p_sort = 'latest' THEN t.created_at END DESC,
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (Crucial for access)
GRANT EXECUTE ON FUNCTION search_topics(TEXT, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_topics(TEXT, INTEGER, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION search_topics(TEXT, INTEGER, INTEGER, TEXT) TO service_role;

-- Reload Schema Cache (Critical for RPC updates)
NOTIFY pgrst, 'reload schema';
