-- ========================================
-- Add User Self Delete Function
-- ========================================

BEGIN;

-- 確保 user_deletion_logs 存在 (如果之前的 patch 沒跑)
CREATE TABLE IF NOT EXISTS public.user_deletion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT,
  profile_snapshot JSONB,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_reason TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用戶自我刪除函式
CREATE OR REPLACE FUNCTION public.user_self_delete(
  p_reason TEXT DEFAULT 'user_requested'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_auth_email TEXT;
  v_new_email TEXT;
  v_domain TEXT;
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
  SELECT email INTO v_auth_email
  FROM auth.users
  WHERE id = v_user_id;

  -- 4. 記錄到 user_deletion_logs
  INSERT INTO public.user_deletion_logs (
    user_id,
    email,
    profile_snapshot,
    deleted_by,
    deleted_reason
  )
  VALUES (
    v_user_id,
    v_auth_email,
    to_jsonb(v_profile),
    v_user_id, -- deleted_by self
    p_reason
  );

  -- 5. 更新 Profile (軟刪除)
  UPDATE public.profiles
  SET is_deleted = true,
      deleted_at = now(),
      deleted_by = v_user_id,
      deleted_reason = p_reason,
      nickname = CONCAT('已刪除用戶-', substr(v_user_id::text, 1, 8)),
      avatar = '💀'
  WHERE id = v_user_id;

  -- 6. 更新 auth.users (混淆 Email 以防止登入與釋放原 Email)
  -- 產生比如 deleted+uuid_timestamp@deleted.local
  IF v_auth_email IS NOT NULL THEN
     v_domain := split_part(v_auth_email, '@', 2);
     IF v_domain IS NULL OR v_domain = '' THEN
       v_domain := 'deleted.local';
     END IF;

     v_new_email := 'deleted+' || substr(v_user_id::text, 1, 8) || '_' || EXTRACT(EPOCH FROM now())::BIGINT || '@' || v_domain;

     UPDATE auth.users
     SET email = v_new_email,
         email_confirmed_at = NULL,
         raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
                              jsonb_build_object(
                                'deleted_at', now(),
                                'deleted_reason', p_reason,
                                'original_email', v_auth_email
                              )
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
      'original_email', v_auth_email
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;
