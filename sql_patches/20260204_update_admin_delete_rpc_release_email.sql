-- RPC: admin_delete_user (Updated V3)
-- Logic Updated:
-- 1. Check Admin Permissions
-- 2. Check current status of target user
-- 3. If ALREADY Soft Deleted -> Perform HARD DELETE (Delete from auth.users)
-- 4. If NOT Soft Deleted -> Perform SOFT DELETE:
--    a. Backup original email to user_deletion_logs
--    b. Rename email in auth.users to free it up.
--       Format: deleted_X_ORIGINAL_EMAIL
--       Where X is (count of existing deleted copies + 1)
--    c. Update profiles as before

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
    v_original_email text;
    v_new_email text;
    v_delete_count integer;
    v_next_count integer;
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
        -- [HARD DELETE]
        DELETE FROM auth.users WHERE id = p_user_id;
        DELETE FROM public.profiles WHERE id = p_user_id; -- Just in case
        
        v_action_type := 'hard_delete';
        v_result_message := 'User permanently deleted.';
    ELSE
        -- [SOFT DELETE]
        
        -- a. Get original email
        SELECT email INTO v_original_email FROM auth.users WHERE id = p_user_id;
        
        -- b. Calculate 'X' (Next Count)
        -- Count how many emails already match 'deleted_%_ORIGINAL_EMAIL'
        SELECT COUNT(*) INTO v_delete_count 
        FROM auth.users 
        WHERE email LIKE 'deleted_%_' || v_original_email;
        
        v_next_count := v_delete_count + 1;
        
        -- Generate new email: deleted_X_original@email.com
        v_new_email := 'deleted_' || v_next_count || '_' || v_original_email;
        
        -- c. Log first (to safe keep original email)
        INSERT INTO public.user_deletion_logs (
            user_id, 
            email, 
            deleted_by, 
            deleted_reason, 
            profile_snapshot
        )
        VALUES (
            p_user_id, 
            v_original_email, 
            auth.uid(), 
            p_reason, 
            (SELECT row_to_json(p) FROM public.profiles p WHERE id = p_user_id)
        );
        
        -- d. Rename email in auth.users to release the original email
        UPDATE auth.users
        SET 
            email = v_new_email,
            encrypted_password = 'DELETED_ACCOUNT_PASSWORD_HASH_INVALID', -- Invalidate password
            raw_user_meta_data = 
                CASE 
                    WHEN raw_user_meta_data IS NULL THEN jsonb_build_object('original_email', v_original_email)
                    ELSE raw_user_meta_data || jsonb_build_object('original_email', v_original_email)
                END,
            updated_at = now()
        WHERE id = p_user_id;
        
        -- e. Update profiles
        UPDATE public.profiles
        SET 
            is_deleted = true,
            deleted_at = now(),
            deleted_reason = p_reason
        WHERE id = p_user_id;
        
        v_action_type := 'soft_delete';
        v_result_message := 'User soft deleted and email released.';
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
