-- CRITICAL SECURITY FIX（2026-08-03 全專案安全體檢發現）：
--
-- 直接查詢正式環境確認以下 6 個函式對 anon（完全未登入）與 authenticated 開放執行權限：
--   add_tokens / deduct_tokens / get_admin_list / grant_admin_privilege / suspend_admin / unsuspend_admin
--
-- 其中 grant_admin_privilege / suspend_admin / unsuspend_admin 內部只檢查「client 傳入的
-- xxx_admin_id 參數是不是管理員」，從未核對這個參數是否等於呼叫者本人（auth.uid()）。
-- 實際攻擊路徑（不需要任何帳號，用公開的 anon key 就能打）：
--   1. add_tokens/deduct_tokens 對任意 user_id 灌任意數量代幣
--   2. get_admin_list() 取得所有管理員 UUID/email
--   3. 用偷來的管理員 UUID 當參數餵給 grant_admin_privilege 讓自己變成管理員
--   4. 同理呼叫 suspend_admin/unsuspend_admin 癱瘓/恢復任意管理員
--
-- 修法：
--   - add_tokens / deduct_tokens：唯二合法前端呼叫（web 版購買 mock、看廣告 RPC 備援）已移除，
--     其餘合法呼叫者（cast-vote/create-topic/complete-mission/watch-ad Edge Functions）已改用
--     service role 呼叫，故直接收回 anon + authenticated 執行權限。
--   - grant_admin_privilege：目前前端沒有任何呼叫點，直接收回 anon + authenticated，並改用
--     auth.uid() 驗證身份（不再信任 client 傳入的參數），未來要重新開放給 UI 呼叫也已經安全。
--   - get_admin_list / suspend_admin / unsuspend_admin：UserManager.tsx 會用登入中的管理員
--     身份直接呼叫，因此仍保留 authenticated 執行權限，但函式內部改用 auth.uid() 驗證呼叫者
--     身份（不再信任 client 傳入的參數），並收回 anon（完全未登入）的執行權限。

-- 1) add_tokens / deduct_tokens：完全收回 client 執行權限，之後只有 service_role 能呼叫
REVOKE EXECUTE ON FUNCTION public.add_tokens(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_tokens(uuid, integer) FROM PUBLIC, anon, authenticated;

-- 2) grant_admin_privilege：完全收回 client 執行權限，並改用 auth.uid() 驗證呼叫者身份
REVOKE EXECUTE ON FUNCTION public.grant_admin_privilege(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.grant_admin_privilege(target_user_id uuid, granting_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 安全修正：granting_admin_id 參數僅保留供呼叫端相容與稽核記錄使用，身份驗證一律採用
  -- auth.uid()，不再信任 client 可任意指定的參數。
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
     AND EXISTS (SELECT 1 FROM public.admin_users) THEN
    RAISE EXCEPTION 'Only admins can grant admin privileges';
  END IF;

  INSERT INTO public.admin_users (user_id, granted_by)
  VALUES (target_user_id, auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    auth.uid(),
    'grant_admin',
    'admin_users',
    target_user_id,
    jsonb_build_object(
      'granted_to', target_user_id,
      'granted_by', auth.uid()
    )
  );
END;
$function$;

-- 3) get_admin_list：加上呼叫者本人必須是管理員的檢查，才重新對 authenticated 開放
REVOKE EXECUTE ON FUNCTION public.get_admin_list() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_list()
RETURNS TABLE(user_id uuid, email text, nickname text, is_super_admin boolean, is_suspended boolean, suspended_at timestamptz, suspended_by uuid, suspended_reason text, granted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: You do not have admin privileges.';
  END IF;

  RETURN QUERY
  SELECT
    au.user_id,
    u.email::TEXT,
    p.nickname,
    au.is_super_admin,
    au.is_suspended,
    au.suspended_at,
    au.suspended_by,
    au.suspended_reason,
    au.granted_at
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.user_id
  LEFT JOIN public.profiles p ON p.id = au.user_id
  ORDER BY au.is_super_admin DESC, au.granted_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_list() TO authenticated;

-- 4) suspend_admin / unsuspend_admin：改用 auth.uid() 驗證呼叫者身份，不再信任
--    p_suspending_admin_id / p_unsuspending_admin_id 參數。UserManager.tsx 目前呼叫時
--    傳入的就是呼叫者自己的 user.id，行為不變；但現在無法再偽造成別人。
REVOKE EXECUTE ON FUNCTION public.suspend_admin(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unsuspend_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.suspend_admin(
  p_target_user_id UUID,
  p_suspending_admin_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  -- 安全修正：一律用 auth.uid() 驗證「執行者是不是最高管理者」，不再信任 p_suspending_admin_id 參數
  SELECT is_super_admin INTO v_is_super_admin
  FROM public.admin_users
  WHERE user_id = auth.uid() AND is_suspended = false;

  IF NOT v_is_super_admin THEN
    RETURN QUERY SELECT false, '只有最高管理者可以暫停其他管理員的權限';
    RETURN;
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RETURN QUERY SELECT false, '不能暫停自己的權限';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = p_target_user_id AND is_super_admin = true
  ) THEN
    RETURN QUERY SELECT false, '不能暫停其他最高管理者的權限';
    RETURN;
  END IF;

  UPDATE public.admin_users
  SET
    is_suspended = true,
    suspended_at = now(),
    suspended_by = auth.uid(),
    suspended_reason = p_reason
  WHERE user_id = p_target_user_id;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    auth.uid(),
    'suspend_admin',
    'admin_users',
    p_target_user_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'reason', p_reason
    )
  );

  RETURN QUERY SELECT true, '管理員權限已暫停';
END;
$$;

CREATE OR REPLACE FUNCTION public.unsuspend_admin(
  p_target_user_id UUID,
  p_unsuspending_admin_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  SELECT is_super_admin INTO v_is_super_admin
  FROM public.admin_users
  WHERE user_id = auth.uid() AND is_suspended = false;

  IF NOT v_is_super_admin THEN
    RETURN QUERY SELECT false, '只有最高管理者可以恢復其他管理員的權限';
    RETURN;
  END IF;

  UPDATE public.admin_users
  SET
    is_suspended = false,
    suspended_at = NULL,
    suspended_by = NULL,
    suspended_reason = NULL
  WHERE user_id = p_target_user_id;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    auth.uid(),
    'unsuspend_admin',
    'admin_users',
    p_target_user_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id
    )
  );

  RETURN QUERY SELECT true, '管理員權限已恢復';
END;
$$;

GRANT EXECUTE ON FUNCTION public.suspend_admin(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unsuspend_admin(uuid, uuid) TO authenticated;

-- 5) 確認結果：add_tokens/deduct_tokens/grant_admin_privilege 的 anon/authenticated 應皆為
--    false；get_admin_list/suspend_admin/unsuspend_admin 則 anon=false、authenticated=true。
SELECT
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_exec,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('add_tokens','deduct_tokens','grant_admin_privilege','get_admin_list','suspend_admin','unsuspend_admin');
