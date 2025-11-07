-- ========================================
-- 修復用戶管理功能
-- 確保函數正確創建並刷新 Schema Cache
-- ========================================

-- 1. 刪除舊的函數（如果存在）
DROP FUNCTION IF EXISTS public.admin_grant_tokens(UUID, INTEGER, UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_grant_free_create(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_user_stats(UUID);

-- 2. 創建函數：派發代幣給用戶
CREATE OR REPLACE FUNCTION public.admin_grant_tokens(
  p_user_id UUID,
  p_amount INTEGER,
  p_admin_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  new_balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- 檢查管理員權限
  IF NOT public.is_admin(p_admin_id) THEN
    RETURN QUERY SELECT false, '權限不足', 0;
    RETURN;
  END IF;

  -- 檢查金額是否有效
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, '代幣數量必須大於 0', 0;
    RETURN;
  END IF;

  -- 更新用戶代幣
  UPDATE public.profiles
  SET tokens = COALESCE(tokens, 0) + p_amount,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING tokens INTO v_new_balance;

  -- 如果用戶不存在
  IF v_new_balance IS NULL THEN
    RETURN QUERY SELECT false, '用戶不存在', 0;
    RETURN;
  END IF;

  -- 記錄交易（如果 token_transactions 表存在）
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'token_transactions'
  ) THEN
    INSERT INTO public.token_transactions (
      user_id,
      transaction_type,
      amount,
      balance_after,
      description,
      created_by
    )
    VALUES (
      p_user_id,
      'admin_grant',
      p_amount,
      v_new_balance,
      COALESCE(p_reason, '管理員派發'),
      p_admin_id
    );
  END IF;

  RETURN QUERY SELECT true, '代幣派發成功', v_new_balance;
END;
$$;

-- 3. 創建函數：派發免費創建資格
CREATE OR REPLACE FUNCTION public.admin_grant_free_create(
  p_user_id UUID,
  p_admin_id UUID,
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
  v_qualification_id UUID;
BEGIN
  -- 檢查管理員權限
  IF NOT public.is_admin(p_admin_id) THEN
    RETURN QUERY SELECT false, '權限不足';
    RETURN;
  END IF;

  -- 檢查用戶是否存在
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN QUERY SELECT false, '用戶不存在';
    RETURN;
  END IF;

  -- 插入免費創建資格
  INSERT INTO public.free_create_qualifications (
    user_id,
    qualification_type,
    source,
    expires_at
  )
  VALUES (
    p_user_id,
    'admin_grant',
    COALESCE(p_reason, '管理員派發'),
    NULL -- 永久有效
  )
  RETURNING id INTO v_qualification_id;

  IF v_qualification_id IS NULL THEN
    RETURN QUERY SELECT false, '派發失敗';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, '免費創建資格派發成功';
END;
$$;

-- 4. 創建函數：獲取用戶統計信息
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_topics INTEGER,
  total_votes INTEGER,
  total_free_votes INTEGER,
  total_tokens INTEGER,
  created_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.topics
      WHERE creator_id = p_user_id
    ), 0) as total_topics,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.votes
      WHERE user_id = p_user_id
    ), 0) as total_votes,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.free_votes
      WHERE user_id = p_user_id
    ), 0) as total_free_votes,
    COALESCE(p.tokens, 0)::INTEGER as total_tokens,
    p.created_at,
    p.last_login_date
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- 5. 驗證函數是否存在
SELECT 
  'admin_grant_tokens function' as object_type,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'admin_grant_tokens'
  ) as exists;

SELECT 
  'admin_grant_free_create function' as object_type,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'admin_grant_free_create'
  ) as exists;

SELECT 
  'get_user_stats function' as object_type,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'get_user_stats'
  ) as exists;

-- 6. 強制重新載入 Schema Cache（多次通知確保生效）
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');

-- 7. 顯示函數簽名
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_grant_tokens', 'admin_grant_free_create', 'get_user_stats')
ORDER BY p.proname;

