-- 用戶清單匯出：修正 profiles 欄位不一致造成的匯出失敗
-- - profiles 沒有 email / last_sign_in_at：改從 auth.users 取得
-- - 不同環境 profiles 可能沒有 is_deleted / is_banned：用 information_schema 防呆，無欄位則回傳 false

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

