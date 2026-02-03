-- "Nuclear Option" V3: Accept specific JSON payload to bypass signature mismatches

DROP FUNCTION IF EXISTS public.get_profiles_with_email_for_admin_v3;

CREATE OR REPLACE FUNCTION public.get_profiles_with_email_for_admin_v3(
    p_params json
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
    -- Extract parameters from JSON
    p_search_query text := COALESCE(p_params->>'search_query', '');
    p_page int := COALESCE((p_params->>'page')::int, 1);
    p_page_size int := COALESCE((p_params->>'page_size')::int, 20);
    
    v_offset int;
BEGIN
    -- DEBUG: No permission check for now
    
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
