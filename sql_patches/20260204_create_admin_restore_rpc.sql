-- RPC: admin_restore_user
-- Logic:
-- 1. Check Admin Permissions
-- 2. Check if user is deleted
-- 3. Retrieve original_email from metadata
-- 4. Check if original_email is available in auth.users
-- 5. If available -> Restore email, set is_deleted=false
-- 6. If unavailable -> Error

CREATE OR REPLACE FUNCTION public.admin_restore_user(
    p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_is_admin boolean;
    v_is_deleted boolean;
    v_current_email text;
    v_original_email text;
    v_email_taken boolean;
    v_meta jsonb;
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
    SELECT is_deleted, email, raw_user_meta_data INTO v_is_deleted, v_current_email, v_meta
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.id = p_user_id;

    IF v_is_deleted IS NULL OR v_is_deleted = false THEN
        RETURN json_build_object('success', false, 'message', 'User is not deleted or not found.');
    END IF;

    -- 3. GET ORIGINAL EMAIL
    -- Try to find it in metadata (set by our delete RPC)
    v_original_email := (v_meta->>'original_email')::text;

    -- If not in metadata, try to parse from "deleted_X_EMAIL" format if possible, or fail?
    -- For safety, if we can't find original email, we might have to keep the current "deleted_..." email 
    -- and just activate the account. But the user probably wants the real email back.
    -- Let's try to assume if it starts with "deleted_", we try to strip it.
    IF v_original_email IS NULL THEN
        -- Fallback: try to extract from deleted_... format
        -- Pattern: deleted_X_real@email.com or deleted_uuid_real@email.com
        -- It's risky to guess. Let's just return specific message if we can't find it.
        RETURN json_build_object('success', false, 'message', 'Original email not found in metadata. Cannot automatically restore email.');
    END IF;

    -- 4. CHECK IF EMAIL IS TAKEN
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE email = v_original_email AND id != p_user_id
    ) INTO v_email_taken;

    IF v_email_taken THEN
        RETURN json_build_object(
            'success', false, 
            'message', 'Original email (' || v_original_email || ') is currently in use by another account. Cannot restore.'
        );
    END IF;

    -- 5. PERFORM RESTORE
    
    -- a. Restore auth.users
    UPDATE auth.users
    SET 
        email = v_original_email,
        -- We DON'T restore password because we don't know it (it was invalidated). 
        -- User must reset password.
        raw_user_meta_data = v_meta - 'deleted_at' - 'deleted_reason' - 'original_email', -- Clean up metadata
        updated_at = now()
    WHERE id = p_user_id;

    -- b. Restore profiles
    UPDATE public.profiles
    SET 
        is_deleted = false,
        deleted_at = NULL,
        deleted_reason = NULL,
        avatar = CASE WHEN avatar = '💀' THEN '' ELSE avatar END -- Reset avatar if it was skeleton? Maybe just leave it.
    WHERE id = p_user_id;

    -- c. Log action
    INSERT INTO public.audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        metadata
    )
    VALUES (
        auth.uid(),
        'admin_restore_user',
        'user',
        p_user_id,
        jsonb_build_object('restored_email', v_original_email)
    );

    RETURN json_build_object(
        'success', true,
        'message', 'User restored successfully. Email reverted to ' || v_original_email
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_restore_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_user(uuid) TO service_role;
