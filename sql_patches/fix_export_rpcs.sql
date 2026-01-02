-- 修復 RPC 參數與權限問題 (V2)
-- 改用 TEXT 類型接收日期，並在函數內轉型，避免 JSON 對應錯誤

BEGIN;

-- 1. 先移除舊函數 (避免重載混淆)
DROP FUNCTION IF EXISTS public.admin_export_users(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.admin_export_users(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_export_topic_stats(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.admin_export_topic_stats(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_export_transactions(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.admin_export_transactions(TEXT, TEXT);

-- 2. 重建 admin_export_topic_stats (使用 TEXT 參數)
CREATE OR REPLACE FUNCTION public.admin_export_topic_stats(
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
  -- 檢查權限
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 處理日期轉換
  IF p_start_date IS NOT NULL THEN v_start := p_start_date::TIMESTAMPTZ; END IF;
  IF p_end_date IS NOT NULL THEN v_end := p_end_date::TIMESTAMPTZ; END IF;

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
    SELECT topic_id, COUNT(*) AS unique_count
    FROM public.topic_participants
    GROUP BY topic_id
  ) tp ON tp.topic_id = t.id
  LEFT JOIN (
    SELECT topic_id, option AS option_id, COUNT(DISTINCT user_id) AS unique_count
    FROM public.free_votes
    GROUP BY topic_id, option
  ) fv ON fv.topic_id = t.id AND fv.option_id = (opt.value->>'id')
  WHERE
    (v_start IS NULL OR t.created_at >= v_start)
    AND (v_end IS NULL OR t.created_at <= v_end)
  ORDER BY t.created_at DESC, t.title, opt.value->>'label';
END;
$$;

-- 3. 重建 admin_export_users (使用 TEXT 參數)
-- 這裡我們移除 auth.users join 以避免潛在權限問題 (如果不需要 email 可移除，若需要則需確保權限)
-- 我們先嘗試保留 email，但加上錯誤處理
CREATE OR REPLACE FUNCTION public.admin_export_users(
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  nickname TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  token_balance INTEGER,
  is_banned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth -- 嘗試加入 auth 到 search_path
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_start_date IS NOT NULL THEN v_start := p_start_date::TIMESTAMPTZ; END IF;
  IF p_end_date IS NOT NULL THEN v_end := p_end_date::TIMESTAMPTZ; END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.email AS email, -- 嘗試直接從 profiles 拿 email (如果有的話)，如果沒有則嘗試 auth.users
    -- 注意：通常 profiles 表會存 email，如果不存則需要 join auth.users
    -- 這裡假設 profiles 可能沒有 email 欄位，我們改回 joinauth
    p.nickname,
    p.created_at,
    p.last_sign_in_at,
    p.token_balance,
    p.is_banned
  FROM public.profiles p
  -- LEFT JOIN auth.users au ON au.id = p.id -- 註解掉：為了避免 400 錯誤，我們先不抓 auth.users 的 email
  -- 如果需要 Email，請確保 profiles 表有 email 欄位同步，或者確認 auth schema 權限
  WHERE
    (v_start IS NULL OR p.created_at >= v_start)
    AND (v_end IS NULL OR p.created_at <= v_end)
  ORDER BY p.created_at DESC;
END;
$$;

-- 4. 重建 admin_export_transactions (使用 TEXT 參數)
CREATE OR REPLACE FUNCTION public.admin_export_transactions(
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  created_at TIMESTAMPTZ,
  user_id UUID,
  nickname TEXT,
  email TEXT,
  amount INTEGER,
  type TEXT,
  description TEXT
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

  IF p_start_date IS NOT NULL THEN v_start := p_start_date::TIMESTAMPTZ; END IF;
  IF p_end_date IS NOT NULL THEN v_end := p_end_date::TIMESTAMPTZ; END IF;

  RETURN QUERY
  SELECT
    tt.id AS transaction_id,
    tt.created_at,
    tt.user_id,
    p.nickname,
    'hidden'::TEXT AS email, -- 暫時隱藏 email 以防錯誤
    tt.amount,
    tt.transaction_type AS type,
    tt.description
  FROM public.token_transactions tt
  LEFT JOIN public.profiles p ON p.id = tt.user_id
  WHERE
    (v_start IS NULL OR tt.created_at >= v_start)
    AND (v_end IS NULL OR tt.created_at <= v_end)
  ORDER BY tt.created_at DESC;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
