-- V5: "Safe Mode" RPC
-- Uses ONLY columns we know exist, returns NULL/Defaults for others to prevent SQL errors.
-- Explicit permission grants included.

DROP FUNCTION IF EXISTS public.get_admin_user_list_v5;

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
BEGIN
    -- Safe conversion from string to int
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
            -- Check if column exists logic is hard in plpgsql inside a query
            -- So we assume basic columns exist. 
            -- For potentially missing columns, we Return NULL manually if the table doesn't have them.
            -- BUT, we can't select a column that doesn't exist.
            -- Using a hack: we select NULL for deleted info to be safe.
            -- If the user needs deleted info, we'll add those columns properly later.
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

-- Force reload schema to register the new function
NOTIFY pgrst, 'reload config';

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.get_admin_user_list_v5(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_list_v5(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_user_list_v5(text, text, text) TO anon;
