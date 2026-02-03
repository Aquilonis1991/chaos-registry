-- SECURITY LOCKDOWN for V5 RPC
-- Now that we confirmed the function works, we must restrict access to Admins only.

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
    -- 1. SECURITY CHECK (The most important part!)
    -- Check if the current user exists in the admin_users table
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
    ) INTO v_is_admin;

    -- Allow service_role to bypass (for internal admin tools)
    IF auth.role() = 'service_role' THEN
        v_is_admin := true;
    END IF;

    -- Reject everyone else
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access Denied: You do not have admin privileges.';
    END IF;

    -- 2. Input Conversion
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
            -- Safe Mode: Return NULL for missing columns
            NULL::timestamptz as last_login_date, 
            FALSE as is_deleted,
            NULL::timestamptz as deleted_at,
            NULL::text as deleted_reason,
            u.email,
            COALESCE(u.raw_app_meta_data->>'provider', u.raw_user_meta_data->>'provider', 'email') as provider,
            COUNT(*) OVER() as full_count
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
        CAST(fu.email AS VARCHAR),
        fu.provider,
        fu.full_count
    FROM filtered_users fu
    ORDER BY fu.created_at DESC
    LIMIT v_size
    OFFSET v_offset;
END;
$$;

-- 3. PERMISSION LOCKDOWN
-- Revoke access from anonymous users (Guests)
REVOKE EXECUTE ON FUNCTION public.get_admin_user_list_v5(text, text, text) FROM anon;

-- Grant access to authenticated users (Required for client to call it)
-- BUT the internal check above will reject them if they aren't admins.
GRANT EXECUTE ON FUNCTION public.get_admin_user_list_v5(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_list_v5(text, text, text) TO service_role;

NOTIFY pgrst, 'reload config';
