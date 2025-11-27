-- 修復 get_user_stats 與 get_user_topics_with_stats 的欄位型別/命名問題
-- 1) 確保 last_login 回傳 TIMESTAMPTZ
-- 2) 消除 created_at 欄位模糊引用

DROP FUNCTION IF EXISTS public.get_user_stats(UUID);
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_topics INTEGER,
  total_votes INTEGER,
  total_free_votes INTEGER,
  total_tokens INTEGER,
  total_deposit_amount NUMERIC,
  watch_ad_count INTEGER,
  click_native_ad_count INTEGER,
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
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.topics WHERE creator_id = p_user_id), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.votes WHERE user_id = p_user_id), 0),
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.free_votes WHERE user_id = p_user_id), 0),
    COALESCE(p.tokens, 0)::INTEGER,
    COALESCE(deposits.total_deposit, 0)::NUMERIC,
    COALESCE(ad_stats.watch_ad_count, 0)::INTEGER,
    COALESCE(ad_stats.click_native_ad_count, 0)::INTEGER,
    p.created_at,
    COALESCE(p.last_login, p.last_login_date::timestamptz)
  FROM public.profiles p
  LEFT JOIN (
    SELECT
      user_id,
      SUM(amount)::NUMERIC AS total_deposit
    FROM public.token_transactions
    WHERE transaction_type IN ('deposit', 'purchase')
    GROUP BY user_id
  ) deposits ON deposits.user_id = p.id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE transaction_type = 'watch_ad')::INT AS watch_ad_count,
      COUNT(*) FILTER (WHERE transaction_type = 'click_native_ad')::INT AS click_native_ad_count
    FROM public.token_transactions
    GROUP BY user_id
  ) ad_stats ON ad_stats.user_id = p.id
  WHERE p.id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats(UUID) TO anon;

DROP FUNCTION IF EXISTS public.get_user_topics_with_stats(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.get_user_topics_with_stats(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  topic_created_at TIMESTAMPTZ,
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
    t.created_at AS topic_created_at,
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

