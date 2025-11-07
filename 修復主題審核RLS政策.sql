-- ========================================
-- 修復主題審核 RLS 政策
-- 確保管理員可以更新審核狀態
-- ========================================

-- 注意：請先執行「添加主題審核欄位.sql」添加必要的欄位

-- 1. 刪除舊的更新政策（如果存在且不允許管理員審核）
-- 注意：只刪除會阻礙審核的政策，保留創建者更新自己主題的能力
DROP POLICY IF EXISTS "Creators can update own topics" ON public.topics;

-- 2. 創建允許創建者更新自己主題的政策（僅限非審核相關欄位）
-- 注意：創建者只能更新待審核的主題，且不能修改審核狀態
CREATE POLICY "Creators can update own topics"
  ON public.topics FOR UPDATE
  USING (
    auth.uid() = creator_id 
    AND approval_status = 'pending'  -- 只能更新待審核的主題
  )
  WITH CHECK (
    auth.uid() = creator_id
    AND approval_status = 'pending'  -- 確保審核狀態保持為 pending
  );

-- 3. 創建允許管理員更新審核狀態的政策
CREATE POLICY "Admins can update approval status"
  ON public.topics FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. 或者創建更寬鬆的政策：允許管理員更新所有欄位
DROP POLICY IF EXISTS "Admins can manage topics" ON public.topics;
CREATE POLICY "Admins can manage topics"
  ON public.topics FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. 驗證政策
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'topics' AND schemaname = 'public'
ORDER BY policyname;

-- 6. 重載 Schema Cache
SELECT pg_notify('pgrst','reload schema');

