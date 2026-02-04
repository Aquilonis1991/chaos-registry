-- ==============================================================================
-- MANUAL FIX SCRIPT (2026-02-04)
-- Please run this entire script in your Supabase Dashboard > SQL Editor
-- This consolidates all recent fixes that failed to apply automatically.
-- ==============================================================================

BEGIN;

-- 1. [Fix] Foreign Key on daily_login_logs (Fixes Delete Error)
-- Drops restrictive constraint and adds ON DELETE CASCADE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_login_logs' AND table_schema = 'public') THEN
        ALTER TABLE public.daily_login_logs DROP CONSTRAINT IF EXISTS daily_login_logs_user_id_fkey;
        ALTER TABLE public.daily_login_logs
        ADD CONSTRAINT daily_login_logs_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        RAISE NOTICE 'Fixed daily_login_logs FK.';
    END IF;
    
    -- Check daily_logins too
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_logins' AND table_schema = 'public') THEN
        ALTER TABLE public.daily_logins DROP CONSTRAINT IF EXISTS daily_logins_user_id_fkey;
        ALTER TABLE public.daily_logins
        ADD CONSTRAINT daily_logins_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        RAISE NOTICE 'Fixed daily_logins FK.';
    END IF;
END $$;


-- 2. [New] check_email_status RPC (For Signup Error Handling)
CREATE OR REPLACE FUNCTION public.check_email_status(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_is_deleted boolean;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
    IF v_user_id IS NULL THEN
        RETURN json_build_object('exists', false, 'is_deleted', false);
    END IF;
    SELECT is_deleted INTO v_is_deleted FROM public.profiles WHERE id = v_user_id;
    RETURN json_build_object('exists', true, 'is_deleted', COALESCE(v_is_deleted, false), 'user_id', v_user_id);
END;
$$;


-- 3. [Update] admin_delete_user RPC (Release Email on Delete)
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
    v_original_email text;
    v_new_email text;
    v_delete_count integer;
BEGIN
    -- Check Admin
    SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) INTO v_is_admin;
    IF auth.role() = 'service_role' THEN v_is_admin := true; END IF;
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Access Denied'; END IF;

    -- Check Status
    SELECT is_deleted INTO v_already_deleted FROM public.profiles WHERE id = p_user_id;
    
    IF v_already_deleted THEN
        -- Hard Delete
        DELETE FROM auth.users WHERE id = p_user_id;
        DELETE FROM public.profiles WHERE id = p_user_id;
        RETURN json_build_object('success', true, 'action', 'hard_delete');
    ELSE
        -- Soft Delete & Release Email
        SELECT email INTO v_original_email FROM auth.users WHERE id = p_user_id;
        
        -- Generate unique deleted email: deleted_N_original
        SELECT COUNT(*) INTO v_delete_count FROM auth.users WHERE email LIKE 'deleted_%_' || v_original_email;
        v_new_email := 'deleted_' || (v_delete_count + 1) || '_' || v_original_email;
        
        -- Backup
        INSERT INTO public.user_deletion_logs (user_id, email, deleted_by, deleted_reason, profile_snapshot)
        VALUES (p_user_id, v_original_email, auth.uid(), p_reason, (SELECT to_jsonb(p) FROM public.profiles p WHERE id = p_user_id));
        
        -- Rename & Soft Delete
        UPDATE auth.users 
        SET email = v_new_email, encrypted_password = 'INVALID', updated_at = now(),
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('original_email', v_original_email)
        WHERE id = p_user_id;
        
        UPDATE public.profiles 
        SET is_deleted = true, deleted_at = now(), deleted_reason = p_reason 
        WHERE id = p_user_id;
        
        RETURN json_build_object('success', true, 'action', 'soft_delete');
    END IF;
END;
$$;


-- 4. [Update] user_self_delete RPC (Release Email on Delete)
CREATE OR REPLACE FUNCTION public.user_self_delete(p_reason TEXT DEFAULT 'user_requested')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_original_email TEXT;
    v_new_email TEXT;
    v_delete_count integer;
BEGIN
    IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_logged_in'); END IF;
    
    -- Check if already deleted
    PERFORM 1 FROM public.profiles WHERE id = v_user_id AND is_deleted = true;
    IF FOUND THEN RETURN jsonb_build_object('success', true, 'status', 'already_deleted'); END IF;

    -- Get Email
    SELECT email INTO v_original_email FROM auth.users WHERE id = v_user_id;
    
    -- Generate unique deleted email
    SELECT COUNT(*) INTO v_delete_count FROM auth.users WHERE email LIKE 'deleted_%_' || v_original_email;
    v_new_email := 'deleted_' || (v_delete_count + 1) || '_' || v_original_email;

    -- Backup
    INSERT INTO public.user_deletion_logs (user_id, email, deleted_by, deleted_reason, profile_snapshot)
    VALUES (v_user_id, v_original_email, v_user_id, p_reason, (SELECT to_jsonb(p) FROM public.profiles p WHERE id = v_user_id));

    -- Update Profile
    UPDATE public.profiles 
    SET is_deleted = true, deleted_at = now(), deleted_by = v_user_id, deleted_reason = p_reason, avatar = '💀' 
    WHERE id = v_user_id;

    -- Release Email
    UPDATE auth.users 
    SET email = v_new_email, email_confirmed_at = NULL, encrypted_password = 'INVALID', updated_at = now(),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('original_email', v_original_email)
    WHERE id = v_user_id;

    -- Audit
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    VALUES (v_user_id, 'user_self_delete', 'user', v_user_id, jsonb_build_object('original_email', v_original_email));

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 5. [New] admin_restore_user RPC (Restore Soft Deleted User)
CREATE OR REPLACE FUNCTION public.admin_restore_user(p_user_id uuid)
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
    -- Check Admin
    SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) INTO v_is_admin;
    IF auth.role() = 'service_role' THEN v_is_admin := true; END IF;
    IF NOT v_is_admin THEN RAISE EXCEPTION 'Access Denied'; END IF;

    SELECT is_deleted, email, raw_user_meta_data INTO v_is_deleted, v_current_email, v_meta
    FROM auth.users u JOIN public.profiles p ON p.id = u.id WHERE u.id = p_user_id;

    IF v_is_deleted IS NULL OR v_is_deleted = false THEN
        RETURN json_build_object('success', false, 'message', 'User is not deleted.');
    END IF;

    -- Logic: Only restore email if it looks like 'deleted_X_...'
    IF v_current_email ~ '^deleted_\d+_' THEN
        v_original_email := (v_meta->>'original_email')::text;
        IF v_original_email IS NOT NULL THEN
            SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = v_original_email AND id != p_user_id) INTO v_email_taken;
            IF v_email_taken THEN
                RETURN json_build_object('success', false, 'message', 'Original email (' || v_original_email || ') is taken.');
            END IF;
            v_should_restore_email := true;
        END IF;
    END IF;

    -- Perform Restore
    IF v_should_restore_email THEN
        UPDATE auth.users 
        SET email = v_original_email, updated_at = now(),
            raw_user_meta_data = v_meta - 'deleted_at' - 'deleted_reason' - 'original_email'
        WHERE id = p_user_id;
    END IF;

    UPDATE public.profiles 
    SET is_deleted = false, deleted_at = NULL, deleted_reason = NULL, 
        avatar = CASE WHEN avatar = '💀' THEN '' ELSE avatar END
    WHERE id = p_user_id;

    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    VALUES (auth.uid(), 'admin_restore_user', 'user', p_user_id, jsonb_build_object('restored_email', v_should_restore_email));

    RETURN json_build_object('success', true, 'message', 'User restored.');
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION public.check_email_status(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_self_delete(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_restore_user(uuid) TO authenticated, service_role;

COMMIT;

-- Force Schema Refresh (Outside transaction block often preferred, but notifying channel is safe inside)
NOTIFY pgrst, 'reload schema';
