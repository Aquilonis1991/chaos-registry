-- ========================================
-- 手動授予特定用戶超級管理員權限
-- 針對用戶 UID: 08fc94c1-bfb3-47ed-9191-b46fa24837f2
-- ========================================

-- 1. 確保 admin_users 表結構正確（包含 is_super_admin 欄位）
-- 如果欄位不存在，這段代碼會自動添加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'admin_users' 
        AND column_name = 'is_super_admin'
    ) THEN
        ALTER TABLE public.admin_users 
        ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 2. 插入或更新用戶為超級管理員
INSERT INTO public.admin_users (user_id, is_super_admin, granted_at)
VALUES (
    '08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid, -- 目標用戶 ID
    true,                                         -- 設為超級管理員
    now()
)
ON CONFLICT (user_id) 
DO UPDATE SET 
    is_super_admin = true,
    granted_at = now(); -- 更新授權時間

-- 3. 強制重置 is_super_admin 函數（確保邏輯一致）
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  v_is_super boolean;
BEGIN
  SELECT is_super_admin INTO v_is_super
  FROM public.admin_users
  WHERE user_id = check_user_id;
  
  RETURN COALESCE(v_is_super, false);
END;
$$;

-- 4. 授予函數執行權限
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

-- 5. 驗證結果提示
DO $$
DECLARE
    v_success boolean;
BEGIN
    SELECT is_super_admin INTO v_success
    FROM public.admin_users
    WHERE user_id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid;
    
    IF v_success THEN
        RAISE NOTICE '成功！用戶 08fc94c1... 已設置為超級管理員';
    ELSE
        RAISE EXCEPTION '設置失敗，請檢查日誌';
    END IF;
END $$;
