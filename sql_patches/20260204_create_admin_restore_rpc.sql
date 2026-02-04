-- RPC: admin_restore_user (V2 Refined)
-- Logic:
-- 1. Check Admin Permissions
-- 2. Check if user is deleted
-- 3. Check if current email matches pattern 'deleted_X_...' (Regex: ^deleted_\d+_)
-- 4. IF MATCHES:
--    a. Retrieve original_email from metadata
--    b. Check collision for original_email
--    c. If collision -> ERROR (Stop restore)
--    d. If safe -> Restore email & cleanup metadata
-- 5. IF NO MATCH:
--    a. Do NOT touch email
--    b. Just clear is_deleted status in profiles
-- 6. Log action

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
    v_should_restore_email boolean := false;
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

    -- 3. CHECK EMAIL PATTERN & PREPARE RESTORE
    -- Check for "deleted_X_" prefix where X is digits
    IF v_current_email ~ '^deleted_\d+_' THEN
        v_original_email := (v_meta->>'original_email')::text;
        
        IF v_original_email IS NOT NULL THEN
            -- Check collision
            SELECT EXISTS (
                SELECT 1 FROM auth.users WHERE email = v_original_email AND id != p_user_id
            ) INTO v_email_taken;

            IF v_email_taken THEN
                RETURN json_build_object(
                    'success', false, 
                    'message', 'Original email (' || v_original_email || ') is currently in use by another account. Cannot restore.'
                );
            END IF;
            
            v_should_restore_email := true;
        ELSE
            -- Matches pattern but no metadata? 
            -- We cannot safely restore email directly. Fallback to just status restore?
            -- Or should we error? User request implies "If not ... don't modify". 
            -- If it DOES match but missing data, we can't restore email. Treat as "don't modify".
            v_should_restore_email := false;
        END IF;
    ELSE
        -- Does not match pattern
        v_should_restore_email := false;
    END IF;

    -- 4. PERFORM RESTORE
    
    IF v_should_restore_email THEN
        -- a. Restore email
        UPDATE auth.users
        SET 
            email = v_original_email,
            raw_user_meta_data = v_meta - 'deleted_at' - 'deleted_reason' - 'original_email',
            updated_at = now()
        WHERE id = p_user_id;
    END IF;

    -- b. Always restore profile status
    UPDATE public.profiles
    SET 
        is_deleted = false,
        deleted_at = NULL,
        deleted_reason = NULL,
        avatar = CASE WHEN avatar = '💀' THEN '' ELSE avatar END
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
        jsonb_build_object(
            'restored_email', CASE WHEN v_should_restore_email THEN v_original_email ELSE NULL END,
            'email_change', v_should_restore_email
        )
    );

    RETURN json_build_object(
        'success', true,
        'message', CASE 
            WHEN v_should_restore_email THEN 'User restored and email reverted to ' || v_original_email 
            ELSE 'User restored (Status only, email unchanged)' 
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_restore_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_user(uuid) TO service_role;

-- Force Schema Cache Refresh
NOTIFY pgrst, 'reload schema';
