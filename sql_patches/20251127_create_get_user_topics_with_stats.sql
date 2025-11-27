-- 建立 get_user_topics_with_stats 函數，提供管理後台查詢用戶主題統計
-- 產出每個主題的代幣票數、免費票數與總票數，避免前端需要不存在的欄位

CREATE OR REPLACE FUNCTION public.get_user_topics_with_stats(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  created_at TIMESTAMPTZ,
  status TEXT,
  token_votes INTEGER,
  free_votes INTEGER,
  total_votes INTEGER,
  last_vote_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.created_at,
    t.status,
    COALESCE(tv.token_votes, 0) AS token_votes,
    COALESCE(fv.free_votes, 0) AS free_votes,
    COALESCE(tv.token_votes, 0) + COALESCE(fv.free_votes, 0) AS total_votes,
    GREATEST(tv.last_token_vote_at, fv.last_free_vote_at) AS last_vote_at
  FROM public.topics t
  LEFT JOIN (
    SELECT
      topic_id,
      COUNT(*)::INT AS token_votes,
      MAX(created_at) AS last_token_vote_at
    FROM public.votes
    GROUP BY topic_id
  ) tv ON tv.topic_id = t.id
  LEFT JOIN (
    SELECT
      topic_id,
      COUNT(*)::INT AS free_votes,
      MAX(created_at) AS last_free_vote_at
    FROM public.free_votes
    GROUP BY topic_id
  ) fv ON fv.topic_id = t.id
  WHERE t.creator_id = p_user_id
  ORDER BY t.created_at DESC
  LIMIT COALESCE(p_limit, 20);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_topics_with_stats(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_topics_with_stats(UUID, INTEGER) TO anon;

-- 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';

