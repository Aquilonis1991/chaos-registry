-- Create RPC to check user status by email
-- Used by access-control Edge Function to validate signup requests
CREATE OR REPLACE FUNCTION public.check_email_status(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_is_deleted boolean;
    v_result json;
BEGIN
    -- Check if email exists in auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'exists', false,
            'is_deleted', false
        );
    END IF;

    -- Check profile status
    SELECT is_deleted INTO v_is_deleted
    FROM public.profiles
    WHERE id = v_user_id;

    RETURN json_build_object(
        'exists', true,
        'is_deleted', COALESCE(v_is_deleted, false),
        'user_id', v_user_id
    );
END;
$$;

-- Grant access to service_role (used by Edge Function)
GRANT EXECUTE ON FUNCTION public.check_email_status(text) TO service_role;
-- Also grant to authenticated/anon just in case, but usually we restrict
GRANT EXECUTE ON FUNCTION public.check_email_status(text) TO anon, authenticated;
