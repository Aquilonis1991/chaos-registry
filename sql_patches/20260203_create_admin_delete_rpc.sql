-- RPC: admin_delete_user
-- Logic:
-- 1. Check Admin Permissions
-- 2. Check current status of target user
-- 3. If ALREADY Soft Deleted -> Perform HARD DELETE (Delete from auth.users)
-- 4. If NOT Soft Deleted -> Perform SOFT DELETE (Update profiles)

CREATE OR REPLACE FUNCTION public.admin_delete_user(
    p_user_id uuid,
    p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_is_admin boolean;
    v_already_deleted boolean;
    v_result_message text;
    v_action_type text;
BEGIN
    -- 1. SECURITY CHECK
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
    ) INTO v_is_admin;

    IF auth.role() = 'service_role' THEN
        v_is_admin := true;
    END IF;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access Denied: You do not have admin privileges.';
    END IF;

    -- 2. CHECK TARGET STATUS
    SELECT is_deleted INTO v_already_deleted
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_already_deleted IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- 3. EXECUTE LOGIC
    IF v_already_deleted THEN
        -- [HARD DELETE] User is already soft deleted, so nuke them form auth.users
        -- This will cascade delete their profile because of foreign keys (usually)
        -- If not, we manually delete profile too.
        
        DELETE FROM auth.users WHERE id = p_user_id;
        
        -- Just in case cascade isn't set up
        DELETE FROM public.profiles WHERE id = p_user_id;
        
        v_action_type := 'hard_delete';
        v_result_message := 'User permanently deleted.';
    ELSE
        -- [SOFT DELETE] specific update
        UPDATE public.profiles
        SET 
            is_deleted = true,
            deleted_at = now(),
            deleted_reason = p_reason
        WHERE id = p_user_id;
        
        v_action_type := 'soft_delete';
        v_result_message := 'User soft deleted.';
    END IF;

    RETURN json_build_object(
        'success', true,
        'action', v_action_type,
        'message', v_result_message
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, text) TO service_role;
