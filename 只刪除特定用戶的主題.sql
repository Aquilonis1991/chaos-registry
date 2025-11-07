-- ==========================================
-- 刪除特定用戶的主題
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- 替換為您的用戶 ID
-- 您的用戶 ID: 08fc94c1-bfb3-47ed-9191-b46fa24837f2

-- 刪除該用戶建立的所有主題
DELETE FROM public.topics 
WHERE creator_id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2';

-- 刪除該用戶的免費投票記錄
DELETE FROM public.free_votes 
WHERE user_id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2';

-- 重置該用戶的代幣
UPDATE public.profiles 
SET tokens = 1000
WHERE id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2';

-- 驗證
SELECT 
  '✅ 該用戶資料已清理！' as status,
  (SELECT COUNT(*) FROM public.topics WHERE creator_id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2') as user_topics,
  (SELECT tokens FROM public.profiles WHERE id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2') as user_tokens;


