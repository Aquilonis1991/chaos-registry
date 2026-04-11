-- Hard-delete (admin 2nd delete) failed with HTTP 409 when auth.users could not be removed:
-- - admin_users.user_id -> profiles(id) default NO ACTION blocks CASCADE profile delete
-- - Several audit columns -> auth.users(id) without ON DELETE block deleting that user

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
    -- Clear FKs that default to NO ACTION (would block DELETE auth.users / CASCADE profiles).
    UPDATE public.admin_users SET suspended_by = NULL WHERE suspended_by = p_user_id;
    DELETE FROM public.admin_users WHERE user_id = p_user_id;

    UPDATE public.user_blocks SET blocked_by = NULL WHERE blocked_by = p_user_id;
    UPDATE public.user_blocks SET unblocked_by = NULL WHERE unblocked_by = p_user_id;
    UPDATE public.ip_blacklist SET blocked_by = NULL WHERE blocked_by = p_user_id;
    UPDATE public.sensitive_words SET added_by = NULL WHERE added_by = p_user_id;

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
