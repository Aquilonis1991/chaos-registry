-- token_transactions_user_id_fkey on hard delete:
-- CASCADE from DELETE auth.users can delete profiles -> topics BEFORE refund_topic_tokens
-- can insert token_transactions, or insert after auth row is gone (FK violation).
-- Fix: (1) delete creator topics explicitly before DELETE auth.users;
-- (2) make refund_topic_tokens a no-op when auth.users(creator_id) no longer exists.

CREATE OR REPLACE FUNCTION public.refund_topic_tokens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  topic_cost integer;
  exposure_cost integer;
  duration_cost integer;
BEGIN
  exposure_cost := CASE OLD.exposure_level
    WHEN 'low' THEN 5
    WHEN 'medium' THEN 10
    WHEN 'high' THEN 15
    ELSE 5
  END;

  duration_cost := CASE OLD.duration_days
    WHEN 1 THEN 3
    WHEN 3 THEN 5
    WHEN 7 THEN 8
    WHEN 14 THEN 12
    ELSE 3
  END;

  topic_cost := exposure_cost + duration_cost;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.creator_id) THEN
    RETURN OLD;
  END IF;

  UPDATE public.profiles
  SET tokens = tokens + topic_cost
  WHERE id = OLD.creator_id;

  INSERT INTO public.token_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    OLD.creator_id,
    topic_cost,
    'refund',
    '主題被刪除，退還代幣',
    OLD.id
  );

  RETURN OLD;
END;
$$;

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

  IF EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = p_user_id
      AND COALESCE(au.is_super_admin, false)
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'cannot_delete_super_admin',
      'message', '超級管理員帳號無法刪除'
    );
  END IF;

  IF v_already_deleted THEN
    UPDATE public.profiles SET deleted_by = NULL WHERE deleted_by = p_user_id;

    UPDATE public.admin_users SET suspended_by = NULL WHERE suspended_by = p_user_id;
    DELETE FROM public.admin_users WHERE user_id = p_user_id;

    UPDATE public.user_blocks SET blocked_by = NULL WHERE blocked_by = p_user_id;
    UPDATE public.user_blocks SET unblocked_by = NULL WHERE unblocked_by = p_user_id;
    UPDATE public.ip_blacklist SET blocked_by = NULL WHERE blocked_by = p_user_id;
    UPDATE public.sensitive_words SET added_by = NULL WHERE added_by = p_user_id;

    DELETE FROM public.topics WHERE creator_id = p_user_id;

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
