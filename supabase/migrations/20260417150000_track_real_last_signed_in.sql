-- 用戶管理「最後登入時間」目前是 GREATEST(profiles.last_login, auth.users.last_sign_in_at)，
-- 但 profiles.last_login 只在使用者按任務頁「立即簽到」時才會更新，語意其實是「上次
-- 簽到」不是「上次登入」——單純打開 App 完全不會動到它。
--
-- 新增一個獨立欄位 last_signed_in_at，只在真正的登入事件（前端 onAuthStateChange 的
-- SIGNED_IN，不含 session 從 storage 恢復或 token 刷新）寫入，跟每日簽到任務完全脫鉤。
-- get_admin_user_list_v5 改用這個欄位取代 profiles.last_login。

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_signed_in_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.last_signed_in_at IS
  '前端 SIGNED_IN 事件觸發時寫入，代表真正的登入時間；與 last_login（每日簽到任務用）語意不同，不要混用';

-- 既有使用者先用 auth.users.last_sign_in_at 回填一次，避免上線當下全部顯示「從未登入」
UPDATE public.profiles p
SET last_signed_in_at = u.last_sign_in_at
FROM auth.users u
WHERE p.id = u.id
  AND p.last_signed_in_at IS NULL
  AND u.last_sign_in_at IS NOT NULL;

-- 供前端在 SIGNED_IN 事件呼叫，只寫自己這筆，不需要額外 RLS UPDATE 政策
CREATE OR REPLACE FUNCTION public.touch_last_signed_in()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET last_signed_in_at = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_last_signed_in() TO authenticated;

-- 管理員清單／明細改用 last_signed_in_at 取代 profiles.last_login
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
            COALESCE(
              GREATEST(p.last_signed_in_at, u.last_sign_in_at),
              p.last_signed_in_at,
              u.last_sign_in_at
            ) AS last_login_date,
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

NOTIFY pgrst, 'reload schema';
