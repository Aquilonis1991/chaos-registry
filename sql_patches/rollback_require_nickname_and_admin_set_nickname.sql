-- =============================================================================
-- 回滾「要求使用者自行改名」＋ 新增「後台直接改暱稱」
-- 與 supabase/migrations/20260408140000_admin_set_user_nickname_rollback_require_flag.sql 相同。
-- 若已用 Supabase CLI migration 套用，請勿重複執行。
-- =============================================================================

-- 回滾「要求使用者自行改名」：移除 must_change_nickname 與相關觸發／函式
-- 改為管理員 RPC 直接修改暱稱：admin_set_user_nickname

DROP TRIGGER IF EXISTS trg_profiles_must_change_nickname_guard ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_must_change_nickname_guard();
DROP FUNCTION IF EXISTS public.admin_require_nickname_change(uuid);

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS must_change_nickname;

-- 還原列表 RPC（不含 must_change_nickname 欄位）
DROP FUNCTION IF EXISTS public.get_admin_user_list_v5(text, text, text);

CREATE OR REPLACE FUNCTION public.get_admin_user_list_v5(
    p_search text,
    p_page_str text,
    p_size_str text
)
RETURNS TABLE (
    id uuid,
    nickname text,
    avatar text,
    tokens int,
    created_at timestamptz,
    last_login_date timestamptz,
    is_deleted boolean,
    deleted_at timestamptz,
    deleted_reason text,
    email varchar,
    provider text,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_page int;
    v_size int;
    v_offset int;
    v_is_admin boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
    ) INTO v_is_admin;

    IF auth.role() = 'service_role' THEN
        v_is_admin := true;
    END IF;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access Denied: You do not have admin privileges.';
    END IF;

    BEGIN
        v_page := p_page_str::int;
        v_size := p_size_str::int;
    EXCEPTION WHEN OTHERS THEN
        v_page := 1;
        v_size := 20;
    END;

    v_offset := (v_page - 1) * v_size;

    RETURN QUERY
    WITH filtered_users AS (
        SELECT
            p.id,
            p.nickname,
            p.avatar,
            p.tokens,
            p.created_at,
            u.last_sign_in_at AS last_login_date,
            COALESCE(p.is_deleted, false) AS is_deleted,
            p.deleted_at,
            p.deleted_reason,
            u.email,
            COALESCE(u.raw_app_meta_data->>'provider', u.raw_user_meta_data->>'provider', 'email') AS provider,
            COUNT(*) OVER() AS full_count
        FROM public.profiles p
        LEFT JOIN auth.users u ON p.id = u.id
        WHERE
            (p_search IS NULL OR p_search = '' OR p.nickname ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%')
    )
    SELECT
        fu.id,
        fu.nickname,
        fu.avatar,
        fu.tokens,
        fu.created_at,
        fu.last_login_date,
        fu.is_deleted,
        fu.deleted_at,
        fu.deleted_reason,
        CAST(fu.email AS varchar),
        fu.provider,
        fu.full_count
    FROM filtered_users fu
    ORDER BY fu.created_at DESC
    LIMIT v_size
    OFFSET v_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_user_list_v5(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_list_v5(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_list_v5(text, text, text) TO service_role;

-- 管理員直接將使用者暱稱改為指定字串（與前端 profile 長度一致：1～50）
CREATE OR REPLACE FUNCTION public.admin_set_user_nickname(p_user_id uuid, p_new_nickname text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trim text;
  v_dup uuid;
  v_count int;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'invalid user');
  END IF;

  v_trim := trim(COALESCE(p_new_nickname, ''));
  IF length(v_trim) < 1 OR length(v_trim) > 50 THEN
    RETURN jsonb_build_object('success', false, 'message', '暱稱長度須為 1～50 字元');
  END IF;

  SELECT p.id INTO v_dup
  FROM public.profiles p
  WHERE lower(p.nickname) = lower(v_trim)
    AND p.id <> p_user_id
  LIMIT 1;

  IF v_dup IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', '此暱稱已被其他用戶使用');
  END IF;

  UPDATE public.profiles
  SET nickname = v_trim
  WHERE id = p_user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'nickname', v_trim);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_nickname(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_nickname(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_nickname(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
