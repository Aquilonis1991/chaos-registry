-- 修復 get_user_stats 函數的欄位名稱問題
-- 確認 topics 表使用 creator_id 欄位（根據 types.ts 確認）

CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_topics INTEGER,
  total_votes INTEGER,
  total_free_votes INTEGER,
  total_tokens INTEGER,
  created_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.topics
      WHERE creator_id = p_user_id
    ), 0) as total_topics,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.votes
      WHERE user_id = p_user_id
    ), 0) as total_votes,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.free_votes
      WHERE user_id = p_user_id
    ), 0) as total_free_votes,
    COALESCE(p.tokens, 0)::INTEGER as total_tokens,
    p.created_at,
    COALESCE(p.last_login, p.last_login_date::TIMESTAMPTZ) as last_login
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';

