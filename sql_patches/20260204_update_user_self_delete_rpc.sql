-- RPC: user_self_delete (Updated V3)
-- Logic Updated:
-- 1. Check Login Status
-- 2. Check current status (if already deleted, return success)
-- 3. Perform SOFT DELETE (similar to admin_delete_user):
--    a. Backup original email to user_deletion_logs
--    b. Rename email in auth.users to free it up.
--       Format: deleted_X_ORIGINAL_EMAIL
--    c. Update profiles
--    d. Log to audit_logs

CREATE OR REPLACE FUNCTION public.user_self_delete(
    p_reason TEXT DEFAULT 'user_requested'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_profile public.profiles%ROWTYPE;
    v_original_email TEXT;
    v_new_email TEXT;
    v_delete_count integer;
    v_next_count integer;
BEGIN
    -- 1. 驗證登入狀態
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_logged_in');
    END IF;

    -- 2. 獲取 Profile
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
    END IF;

    IF v_profile.is_deleted THEN
        RETURN jsonb_build_object('success', true, 'status', 'already_deleted');
    END IF;

    -- 3. 獲取 Email
    SELECT email INTO v_original_email
    FROM auth.users
    WHERE id = v_user_id;

    -- Calc 'X'
    SELECT COUNT(*) INTO v_delete_count 
    FROM auth.users 
    WHERE email LIKE 'deleted_%_' || v_original_email;
    v_next_count := v_delete_count + 1;
    v_new_email := 'deleted_' || v_next_count || '_' || v_original_email;

    -- 4. 記錄到 user_deletion_logs (與 admin_delete_user 一致)
    INSERT INTO public.user_deletion_logs (
        user_id,
        email,
        deleted_by,
        deleted_reason,
        profile_snapshot
    )
    VALUES (
        v_user_id,
        v_original_email,
        v_user_id, -- deleted_by self
        p_reason,
        to_jsonb(v_profile)
    );

    -- 5. 更新 Profile (軟刪除)
    UPDATE public.profiles
    SET is_deleted = true,
        deleted_at = now(),
        deleted_by = v_user_id,
        deleted_reason = p_reason,
        -- 可選：是否要改名？Admin delete 沒改名，但 user_self_delete 原本有。
        -- 讓它保持原樣比較好，避免前端顯示問題，或統一邏輯。
        -- 既然釋放了 Email，Nickname 其實可以留著，或者加個標記。
        -- 為了避免混淆，這裡不改 nickname，只標記狀態。
        avatar = '💀'
    WHERE id = v_user_id;

    -- 6. 更新 auth.users (釋放 Email)
    IF v_original_email IS NOT NULL THEN
         UPDATE auth.users
         SET email = v_new_email,
             email_confirmed_at = NULL,
             encrypted_password = 'DELETED_ACCOUNT_PASSWORD_HASH_INVALID',
             raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
                                  jsonb_build_object(
                                    'deleted_at', now(),
                                    'deleted_reason', p_reason,
                                    'original_email', v_original_email
                                  ),
             updated_at = now()
         WHERE id = v_user_id;
    END IF;

    -- 7. 寫入 Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        metadata
    )
    VALUES (
        v_user_id,
        'user_self_delete',
        'user',
        v_user_id,
        jsonb_build_object(
            'reason', p_reason,
            'original_email', v_original_email,
            'new_email', v_new_email
        )
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
