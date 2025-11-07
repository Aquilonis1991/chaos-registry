-- ==========================================
-- 快速清理 - 僅刪除主題和投票
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- 刪除所有主題
DELETE FROM public.topics;

-- 刪除所有投票記錄
DELETE FROM public.free_votes;
DELETE FROM public.votes WHERE true;

-- 重置用戶代幣為 1000
UPDATE public.profiles SET tokens = 1000;

-- 驗證
SELECT 
  '✅ 清理完成！' as status,
  (SELECT COUNT(*) FROM public.topics) as topic_count,
  (SELECT COUNT(*) FROM public.free_votes) as vote_count;


