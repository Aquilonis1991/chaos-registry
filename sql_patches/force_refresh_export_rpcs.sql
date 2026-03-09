-- 強制重建匯出函數以解決 400 錯誤 (參數名稱不匹配)
-- 先刪除舊函數，確保沒有簽章衝突

BEGIN;

-- 1. admin_export_topic_stats_v2
DROP FUNCTION IF EXISTS public.admin_export_topic_stats_v2(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_export_topic_stats_v2(TIMESTAMPTZ, TIMESTAMPTZ);

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
    COALESCE(opt.value->>'text', opt.value->>'label', '')::TEXT AS option_label,
    (opt.value->>'votes')::INTEGER AS option_votes,
    COALESCE(fv.unique_count, 0) AS option_free_unique_voters
  FROM public.topics t
  CROSS JOIN LATERAL jsonb_array_elements(t.options) WITH ORDINALITY AS opt(value, ord)
  LEFT JOIN (
    SELECT tp_inner.topic_id AS topic_id, COUNT(*) AS unique_count
    FROM public.topic_participants tp_inner
    GROUP BY tp_inner.topic_id
  ) tp ON tp.topic_id = t.id
  LEFT JOIN (
    SELECT fv_inner.topic_id AS topic_id, fv_inner.option AS option_id, COUNT(DISTINCT fv_inner.user_id) AS unique_count
    FROM public.free_votes fv_inner
    GROUP BY fv_inner.topic_id, fv_inner.option
  ) fv ON fv.topic_id = t.id
    AND (
      fv.option_id = (opt.value->>'id')
      OR ((opt.value->>'id') IS NULL AND fv.option_id = ('option-' || (opt.ord - 1)::text))
    )
  WHERE
    (v_start IS NULL OR t.created_at >= v_start)
    AND (v_end IS NULL OR t.created_at <= v_end)
  ORDER BY t.created_at DESC, t.title, COALESCE(opt.value->>'text', opt.value->>'label');
END;
$$;

-- 2. admin_export_users_v2
DROP FUNCTION IF EXISTS public.admin_export_users_v2(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_export_users_v2(TIMESTAMPTZ, TIMESTAMPTZ);

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
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_has_is_deleted BOOLEAN;
  v_has_is_banned BOOLEAN;
  v_is_banned_expr TEXT;
  v_sql TEXT;
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

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_deleted'
  ) INTO v_has_is_deleted;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_banned'
  ) INTO v_has_is_banned;

  v_is_banned_expr := CASE
    WHEN v_has_is_deleted THEN 'COALESCE(p.is_deleted, false)'
    WHEN v_has_is_banned THEN 'COALESCE(p.is_banned, false)'
    ELSE 'false'
  END;

  v_sql := '
    SELECT
      p.id AS user_id,
      COALESCE(u.email, '''')::TEXT AS email,
      p.nickname,
      p.created_at,
      u.last_sign_in_at AS last_sign_in_at,
      COALESCE(p.tokens, 0) AS token_balance,
      ' || v_is_banned_expr || ' AS is_banned
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE
      ($1::timestamptz IS NULL OR p.created_at >= $1::timestamptz)
      AND ($2::timestamptz IS NULL OR p.created_at <= $2::timestamptz)
    ORDER BY p.created_at DESC
  ';

  RETURN QUERY EXECUTE v_sql USING v_start, v_end;
END;
$$;

-- 3. admin_export_transactions_v2
DROP FUNCTION IF EXISTS public.admin_export_transactions_v2(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_export_transactions_v2(TIMESTAMPTZ, TIMESTAMPTZ);

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
SET search_path = public, auth
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
    COALESCE(u.email, '')::TEXT AS email,
    tt.amount,
    tt.transaction_type AS type,
    tt.description
  FROM public.token_transactions tt
  LEFT JOIN public.profiles p ON p.id = tt.user_id
  LEFT JOIN auth.users u ON u.id = tt.user_id
  WHERE
    (v_start IS NULL OR tt.created_at >= v_start)
    AND (v_end IS NULL OR tt.created_at <= v_end)
  ORDER BY tt.created_at DESC;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
