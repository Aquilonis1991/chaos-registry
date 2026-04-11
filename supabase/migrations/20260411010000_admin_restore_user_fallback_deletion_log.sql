-- When raw_user_meta_data lacks original_email (legacy deletes), restore email from user_deletion_logs.

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
  v_email_from_log text;
  v_email_taken boolean;
  v_meta jsonb;
  v_should_restore_email boolean := false;
  v_looks_like_placeholder boolean := false;
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

  SELECT p.is_deleted, u.email, u.raw_user_meta_data
  INTO v_is_deleted, v_current_email, v_meta
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_user_id;

  IF v_is_deleted IS NULL OR v_is_deleted = false THEN
    RETURN json_build_object('success', false, 'message', 'User is not deleted or not found.');
  END IF;

  v_original_email := nullif(trim(v_meta->>'original_email'), '');

  IF v_original_email IS NULL THEN
    SELECT l.email INTO v_email_from_log
    FROM public.user_deletion_logs l
    WHERE l.user_id = p_user_id
      AND l.email IS NOT NULL
      AND btrim(l.email) <> ''
    ORDER BY l.deleted_at DESC NULLS LAST, l.id DESC
    LIMIT 1;

    v_original_email := nullif(trim(v_email_from_log), '');
  END IF;

  IF v_original_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Cannot restore email: no original_email in user metadata and no email found in user_deletion_logs for this user.'
    );
  END IF;

  v_looks_like_placeholder :=
    (v_current_email ~ '^deleted_\d+_')
    OR (v_current_email ~* '^deleted\.[0-9a-f]{32}@');

  IF v_looks_like_placeholder
     AND lower(v_current_email) IS DISTINCT FROM lower(v_original_email)
  THEN
    SELECT EXISTS (
      SELECT 1 FROM auth.users WHERE lower(email) = lower(v_original_email) AND id <> p_user_id
    ) INTO v_email_taken;

    IF v_email_taken THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Original email (' || v_original_email || ') is currently in use by another account. Cannot restore.'
      );
    END IF;

    v_should_restore_email := true;
  END IF;

  IF v_should_restore_email THEN
    UPDATE auth.users u
    SET
      email = v_original_email,
      email_confirmed_at = coalesce(u.email_confirmed_at, now()),
      raw_user_meta_data = u.raw_user_meta_data - 'deleted_at' - 'deleted_reason' - 'original_email',
      updated_at = now()
    WHERE u.id = p_user_id;

    UPDATE auth.identities i
    SET
      provider_id = v_original_email,
      identity_data = coalesce(i.identity_data, '{}'::jsonb)
        || jsonb_build_object(
          'email', v_original_email,
          'sub', v_original_email,
          'email_verified', true
        ),
      updated_at = now()
    WHERE i.user_id = p_user_id
      AND i.provider = 'email';
  END IF;

  UPDATE public.profiles
  SET
    is_deleted = false,
    deleted_at = NULL,
    deleted_reason = NULL,
    avatar = CASE WHEN avatar = '💀' THEN '' ELSE avatar END
  WHERE id = p_user_id;

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
      'email_change', v_should_restore_email,
      'original_email_source', CASE WHEN v_email_from_log IS NOT NULL AND nullif(trim(v_meta->>'original_email'), '') IS NULL THEN 'user_deletion_logs' ELSE 'metadata' END
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', CASE
      WHEN v_should_restore_email THEN 'User restored and email reverted to ' || v_original_email
      ELSE 'User restored (profile only; current email does not look like a delete placeholder)'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_restore_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_user(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
