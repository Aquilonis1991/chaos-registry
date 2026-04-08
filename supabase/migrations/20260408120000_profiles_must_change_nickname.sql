-- 管理員可強制使用者下次登入後須修改暱稱；成功改名後自動清除旗標。

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_nickname boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_nickname IS 'true：使用者須先修改暱稱才可繼續使用（後台設定）';

-- 防止使用者僅以 UPDATE 關閉旗標而未改暱稱；暱稱變更時自動清除
CREATE OR REPLACE FUNCTION public.profiles_must_change_nickname_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.nickname IS DISTINCT FROM OLD.nickname THEN
      NEW.must_change_nickname := false;
    ELSIF COALESCE(OLD.must_change_nickname, false)
      AND COALESCE(NEW.must_change_nickname, false) = false
    THEN
      NEW.must_change_nickname := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_must_change_nickname_guard ON public.profiles;
CREATE TRIGGER trg_profiles_must_change_nickname_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_must_change_nickname_guard();

-- 管理員：要求指定使用者強制改名
CREATE OR REPLACE FUNCTION public.admin_require_nickname_change(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'invalid user');
  END IF;

  UPDATE public.profiles
  SET must_change_nickname = true
  WHERE id = p_user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_require_nickname_change(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_require_nickname_change(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_require_nickname_change(uuid) TO service_role;

-- 管理員列表 RPC：回傳 must_change_nickname
-- 回傳欄位變更時須先 DROP，否則 42P13（cannot change return type of existing function）
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
    must_change_nickname boolean,
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
            COALESCE(p.must_change_nickname, false) AS must_change_nickname,
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
        fu.must_change_nickname,
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

NOTIFY pgrst, 'reload schema';
