-- 清除所有用戶行為數據（包括投票、創建主題等）
-- 警告：此操作會清除所有用戶的投票記錄和創建的主題，請謹慎使用！

-- 查看清除前的統計
SELECT 
  '清除前統計' as status,
  (SELECT COUNT(*) FROM public.votes) as votes_count,
  (SELECT COUNT(*) FROM public.free_votes) as free_votes_count,
  (SELECT COUNT(*) FROM public.topics) as topics_count,
  (SELECT COUNT(*) FROM public.user_missions) as missions_count;

-- 清除所有投票記錄
DELETE FROM public.votes;
DELETE FROM public.free_votes;

-- 清除所有任務完成記錄
DELETE FROM public.user_missions;

-- 清除所有主題（這會重置「話題創造者」任務）
-- 警告：這會刪除所有用戶創建的主題！
DELETE FROM public.topics;

-- 如果需要只清除特定用戶創建的主題，請使用以下代碼（替換 '用戶ID'）：
-- DELETE FROM public.topics WHERE creator_id = '用戶ID';

-- 顯示清除後的結果
SELECT 
  '清除後統計' as status,
  (SELECT COUNT(*) FROM public.votes) as votes_count,
  (SELECT COUNT(*) FROM public.free_votes) as free_votes_count,
  (SELECT COUNT(*) FROM public.topics) as topics_count,
  (SELECT COUNT(*) FROM public.user_missions) as missions_count;

-- 確認清除完成
SELECT '所有用戶行為數據已清除' as result;

