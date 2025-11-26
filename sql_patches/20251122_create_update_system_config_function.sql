-- ========================================
-- 20251122 - 創建更新系統配置的 RPC 函數
-- ========================================
-- 使用 SECURITY DEFINER 繞過 RLS，確保管理員可以更新配置

-- 創建或替換更新系統配置的函數
CREATE OR REPLACE FUNCTION public.update_system_config(
  p_config_id uuid,
  p_new_value jsonb
)
RETURNS TABLE (
  id uuid,
  key text,
  value jsonb,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 檢查管理員權限
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '權限不足：只有管理員可以更新系統配置';
  END IF;

  -- 更新配置
  UPDATE public.system_config
  SET 
    value = p_new_value,
    updated_at = now()
  WHERE id = p_config_id
  RETURNING 
    system_config.id,
    system_config.key,
    system_config.value,
    system_config.updated_at
  INTO 
    id,
    key,
    value,
    updated_at;

  -- 如果沒有找到配置項，拋出錯誤
  IF id IS NULL THEN
    RAISE EXCEPTION '找不到指定的配置項';
  END IF;

  -- 返回更新後的數據
  RETURN NEXT;
END;
$$;

-- 授予執行權限給認證用戶
GRANT EXECUTE ON FUNCTION public.update_system_config(uuid, jsonb) TO authenticated;

-- 測試函數（可選，用於驗證）
-- SELECT * FROM public.update_system_config(
--   (SELECT id FROM public.system_config WHERE key = 'ad_insertion_interval' LIMIT 1),
--   to_jsonb(5::integer)
-- );

