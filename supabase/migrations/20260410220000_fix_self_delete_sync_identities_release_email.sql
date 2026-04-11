-- Fix: after self-delete (or admin soft-delete), the original email must be reusable.
-- Root cause: updating auth.users.email alone may leave auth.identities (email provider)
-- still keyed to the old email, blocking re-registration with the same address.

CREATE OR REPLACE FUNCTION public.user_self_delete(p_reason text DEFAULT 'user_requested')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_original_email text;
  v_new_email text;
  v_domain text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_logged_in');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  IF v_profile.is_deleted THEN
    RETURN jsonb_build_object('success', true, 'status', 'already_deleted');
  END IF;

  SELECT u.email INTO v_original_email
  FROM auth.users u
  WHERE u.id = v_user_id;

  -- Deterministic placeholder email (avoids LIKE wildcards in original address and stays unique).
  v_domain := nullif(lower(split_part(trim(v_original_email), '@', 2)), '');
  IF v_domain IS NULL THEN
    v_domain := 'released.invalid';
  END IF;
  v_new_email := 'deleted.' || replace(v_user_id::text, '-', '') || '@' || v_domain;

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
    v_user_id,
    p_reason,
    to_jsonb(v_profile)
  );

  UPDATE public.profiles
  SET
    is_deleted = true,
    deleted_at = now(),
    deleted_by = v_user_id,
    deleted_reason = p_reason,
    avatar = '💀'
  WHERE id = v_user_id;

  IF v_original_email IS NOT NULL THEN
    UPDATE auth.users u
    SET
      email = v_new_email,
      email_confirmed_at = NULL,
      encrypted_password = 'DELETED_ACCOUNT_PASSWORD_HASH_INVALID',
      raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'deleted_at', now(),
          'deleted_reason', p_reason,
          'original_email', v_original_email
        ),
      updated_at = now()
    WHERE u.id = v_user_id;

    -- Keep email identity in sync so the old email is not reserved by identities.
    UPDATE auth.identities i
    SET
      provider_id = v_new_email,
      identity_data = coalesce(i.identity_data, '{}'::jsonb)
        || jsonb_build_object(
          'email', v_new_email,
          'sub', v_new_email,
          'email_verified', false
        ),
      updated_at = now()
    WHERE i.user_id = v_user_id
      AND i.provider = 'email';
  END IF;

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

  RETURN jsonb_build_object('success', true, 'released_email', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_self_delete(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_self_delete(text) TO service_role;

-- Admin soft-delete: same identity sync + stable placeholder email.
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid, p_reason text DEFAULT NULL)
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
  v_domain text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  ) INTO v_is_admin;

  IF auth.role() = 'service_role' THEN
    v_is_admin := true;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access Denied: You do not have admin privileges.';
  END IF;

  SELECT is_deleted INTO v_already_deleted
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_already_deleted IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_already_deleted THEN
    DELETE FROM auth.users WHERE id = p_user_id;
    DELETE FROM public.profiles WHERE id = p_user_id;

    v_action_type := 'hard_delete';
    v_result_message := 'User permanently deleted.';
  ELSE
    SELECT u.email INTO v_original_email
    FROM auth.users u
    WHERE u.id = p_user_id;

    v_domain := nullif(lower(split_part(trim(v_original_email), '@', 2)), '');
    IF v_domain IS NULL THEN
      v_domain := 'released.invalid';
    END IF;
    v_new_email := 'deleted.' || replace(p_user_id::text, '-', '') || '@' || v_domain;

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

    IF v_original_email IS NOT NULL THEN
      UPDATE auth.users u
      SET
        email = v_new_email,
        email_confirmed_at = NULL,
        encrypted_password = 'DELETED_ACCOUNT_PASSWORD_HASH_INVALID',
        raw_user_meta_data =
          CASE
            WHEN u.raw_user_meta_data IS NULL THEN jsonb_build_object('original_email', v_original_email)
            ELSE u.raw_user_meta_data || jsonb_build_object('original_email', v_original_email)
          END,
        updated_at = now()
      WHERE u.id = p_user_id;

      UPDATE auth.identities i
      SET
        provider_id = v_new_email,
        identity_data = coalesce(i.identity_data, '{}'::jsonb)
          || jsonb_build_object(
            'email', v_new_email,
            'sub', v_new_email,
            'email_verified', false
          ),
        updated_at = now()
      WHERE i.user_id = p_user_id
        AND i.provider = 'email';
    END IF;

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

NOTIFY pgrst, 'reload schema';
