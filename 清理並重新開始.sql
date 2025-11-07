-- 清理現有資料並重新開始
-- 在 Supabase SQL Editor 執行

-- 1. 刪除所有現有主題
DELETE FROM public.topics;

-- 2. 刪除所有投票記錄
DELETE FROM public.free_votes;
DELETE FROM public.votes;

-- 3. 刪除所有代幣交易記錄（可選）
DELETE FROM public.token_transactions;

-- 4. 重置所有用戶代幣為 1000（可選）
UPDATE public.profiles
SET tokens = 1000;

-- 5. 驗證清理結果
SELECT 
  '✅ 清理完成！' as status,
  (SELECT COUNT(*) FROM public.topics) as topic_count,
  (SELECT COUNT(*) FROM public.free_votes) as free_vote_count,
  (SELECT COUNT(*) FROM public.votes) as vote_count,
  (SELECT COUNT(*) FROM public.profiles) as profile_count,
  (SELECT SUM(tokens) FROM public.profiles) as total_tokens;


