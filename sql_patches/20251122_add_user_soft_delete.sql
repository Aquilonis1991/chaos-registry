-- ========================================
-- 20251122 - 用戶軟刪除流程與紀錄
-- ========================================

BEGIN;

-- 1. profiles 新增軟刪除欄位
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON public.profiles(is_deleted);

-- 2. 建立 user_deletion_logs，保留刪除紀錄與快照
CREATE TABLE IF NOT EXISTS public.user_deletion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT,
  profile_snapshot JSONB,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_reason TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_deletion_logs_user_id ON public.user_deletion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_deletion_logs_deleted_at ON public.user_deletion_logs(deleted_at DESC);

ALTER TABLE public.user_deletion_logs ENABLE ROW LEVEL SECURITY;

-- 僅允許管理員讀取與管理刪除紀錄
DROP POLICY IF EXISTS "Admins manage deletion logs" ON public.user_deletion_logs;
CREATE POLICY "Admins manage deletion logs"
  ON public.user_deletion_logs
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 3. 管理員軟刪除函式
DROP FUNCTION IF EXISTS public.admin_soft_delete_user(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.admin_soft_delete_user(
  p_target_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_auth_email TEXT;
  v_new_email TEXT := NULL;
  v_domain TEXT;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_user');
  END IF;

  IF p_target_user_id = v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_delete_self');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  IF v_profile.is_deleted THEN
    RETURN jsonb_build_object('success', true, 'status', 'already_deleted');
  END IF;

  SELECT email
  INTO v_auth_email
  FROM auth.users
  WHERE id = p_target_user_id;

  INSERT INTO public.user_deletion_logs (
    user_id,
    email,
    profile_snapshot,
    deleted_by,
    deleted_reason
  )
  VALUES (
    p_target_user_id,
    v_auth_email,
    to_jsonb(v_profile),
    v_admin_id,
    p_reason
  );

  UPDATE public.profiles
  SET is_deleted = true,
      deleted_at = now(),
      deleted_by = v_admin_id,
      deleted_reason = p_reason,
      nickname = CONCAT('已刪除用戶-', substr(id::text, 1, 8)),
      avatar = '👤'
  WHERE id = p_target_user_id;

  IF v_auth_email IS NOT NULL THEN
    v_domain := split_part(v_auth_email, '@', 2);
    IF v_domain IS NULL OR v_domain = '' THEN
      v_domain := 'deleted.local';
    END IF;

    v_new_email := 'deleted+' || substr(p_target_user_id::text, 1, 8) || '_' ||
      EXTRACT(EPOCH FROM now())::BIGINT || '@' || v_domain;

    UPDATE auth.users
    SET email = v_new_email,
        email_confirmed_at = NULL,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object(
            'deleted_at', now(),
            'deleted_reason', COALESCE(p_reason, ''),
            'deleted_by', v_admin_id
          )
    WHERE id = p_target_user_id;
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    v_admin_id,
    'admin_soft_delete_user',
    'user',
    p_target_user_id::text,
    jsonb_build_object(
      'reason', p_reason,
      'original_email', v_auth_email,
      'new_email', v_new_email
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_email', v_new_email
  );
END;
$$;

COMMIT;

