-- ==========================================
-- 修復刪除主題功能
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- 問題：有一個政策完全禁止刪除 topics
-- 解決：刪除該禁止政策，創建允許創建者刪除自己主題的政策

-- 1. 刪除禁止刪除的政策
DROP POLICY IF EXISTS "Deny DELETE on topics" ON public.topics;

-- 2. 創建允許創建者刪除自己主題的政策
CREATE POLICY "Creators can delete own topics"
  ON public.topics FOR DELETE
  USING (auth.uid() = creator_id);

-- 3. 驗證政策
SELECT 
  'Topics DELETE 政策' as section,
  policyname,
  cmd,
  qual as using_clause
FROM pg_policies
WHERE tablename = 'topics'
  AND cmd = 'DELETE';

