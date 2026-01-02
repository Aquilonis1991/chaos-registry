-- 建立 V2 版本匯出函數 (避開舊函數簽章衝突)
-- 使用 TEXT 參數以確保 JSON 傳輸相容性

BEGIN;

-- 1. admin_export_topic_stats_v2
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
  -- 檢查權限
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 處理日期轉換 (容錯處理)
  BEGIN
    IF p_start_date IS NOT NULL THEN v_start := p_start_date::TIMESTAMPTZ; END IF;
    IF p_end_date IS NOT NULL THEN v_end := p_end_date::TIMESTAMPTZ; END IF;
  EXCEPTION WHEN OTHERS THEN
    -- 如果日期格式錯誤，視為 NULL (不篩選)
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

-- 2. admin_export_users_v2
CREATE OR REPLACE FUNCTION public.admin_export_users_v2(
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
    p.id AS user_id,
    p.email AS email, -- 嘗試直接從 profiles 拿
    p.nickname,
    p.created_at,
    p.last_sign_in_at,
    p.token_balance,
    p.is_banned
  FROM public.profiles p
  WHERE
    (v_start IS NULL OR p.created_at >= v_start)
    AND (v_end IS NULL OR p.created_at <= v_end)
  ORDER BY p.created_at DESC;
END;
$$;

-- 3. admin_export_transactions_v2
CREATE OR REPLACE FUNCTION public.admin_export_transactions_v2(
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

  BEGIN
    IF p_start_date IS NOT NULL THEN v_start := p_start_date::TIMESTAMPTZ; END IF;
    IF p_end_date IS NOT NULL THEN v_end := p_end_date::TIMESTAMPTZ; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_start := NULL;
    v_end := NULL;
  END;

  RETURN QUERY
  SELECT
    tt.id AS transaction_id,
    tt.created_at,
    tt.user_id,
    p.nickname,
    'hidden'::TEXT AS email,
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
