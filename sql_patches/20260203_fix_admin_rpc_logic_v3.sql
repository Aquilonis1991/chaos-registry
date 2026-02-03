-- Comprehensive fix for get_profiles_with_email_for_admin
-- Checks multiple sources of truth for admin status to match frontend logic

DROP FUNCTION IF EXISTS public.get_profiles_with_email_for_admin;

CREATE OR REPLACE FUNCTION public.get_profiles_with_email_for_admin(
    p_search_query TEXT DEFAULT '',
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    nickname TEXT,
    avatar TEXT,
    tokens INT,
    created_at TIMESTAMPTZ,
    last_login_date TIMESTAMPTZ,
    is_deleted BOOLEAN,
    deleted_at TIMESTAMPTZ,
    deleted_reason TEXT,
    email VARCHAR,
    provider TEXT,
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER -- Required to access auth.users
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_admin_check BOOLEAN := false;
    v_offset INT;
BEGIN
    -- 1. Check if caller is Admin or Super Admin
    -- We try multiple methods to be robust
    
    -- Method A: Service Role
    IF auth.role() = 'service_role' THEN
        v_admin_check := true;
    END IF;

    -- Method B: Check admin_users table (Explicit list)
    IF NOT v_admin_check THEN
        SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) INTO v_admin_check;
    END IF;

    -- Method C: Check is_admin() function if it exists (Frontend uses this)
    IF NOT v_admin_check THEN
        BEGIN
            -- Attempt to call is_admin(user_id)
            SELECT public.is_admin(auth.uid()) INTO v_admin_check;
        EXCEPTION WHEN OTHERS THEN
            -- Function might not exist or signature mismatch, ignore
            NULL;
        END;
    END IF;
    
    -- Method D: Check is_super_admin() function if it exists
    IF NOT v_admin_check THEN
        BEGIN
            SELECT public.is_super_admin(auth.uid()) INTO v_admin_check;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    IF NOT v_admin_check THEN
        RAISE EXCEPTION 'Access Denied: User is not an admin';
    END IF;

    v_offset := (p_page - 1) * p_page_size;

    RETURN QUERY
    WITH filtered_users AS (
        SELECT 
            p.id,
            p.nickname,
            p.avatar,
            p.tokens,
            p.created_at,
            p.last_login_date,
            p.is_deleted,
            p.deleted_at,
            p.deleted_reason,
            u.email,
            COALESCE(u.raw_app_meta_data->>'provider', u.raw_user_meta_data->>'provider', 'email') as provider,
            COUNT(*) OVER() as full_count
        FROM public.profiles p
        LEFT JOIN auth.users u ON p.id = u.id
        WHERE 
            (p_search_query IS NULL OR p_search_query = '' OR p.nickname ILIKE '%' || p_search_query || '%' OR u.email ILIKE '%' || p_search_query || '%')
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
    LIMIT p_page_size
    OFFSET v_offset;
END;
$$;
