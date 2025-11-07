-- ==========================================
-- 完整清理資料庫 - 刪除所有測試資料
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- 警告：此操作會刪除所有用戶資料！
-- 僅在開發/測試環境使用

-- ==========================================
-- 1. 刪除所有主題相關資料
-- ==========================================

-- 刪除所有主題（會自動刪除關聯的投票記錄，因為有 ON DELETE CASCADE）
DELETE FROM public.topics;

-- 刪除免費投票記錄
DELETE FROM public.free_votes;

-- 刪除投票記錄（如果有舊的 votes 表）
DELETE FROM public.votes WHERE true;

-- ==========================================
-- 2. 刪除交易和任務記錄
-- ==========================================

-- 刪除代幣交易記錄
DELETE FROM public.token_transactions;

-- 刪除用戶任務進度
DELETE FROM public.user_missions;

-- ==========================================
-- 3. 刪除日誌和報告
-- ==========================================

-- 刪除審計日誌
DELETE FROM public.audit_logs;

-- 刪除檢舉記錄
DELETE FROM public.reports;

-- ==========================================
-- 4. 重置用戶資料（可選）
-- ==========================================

-- 選項 A: 重置所有用戶代幣為 1000
UPDATE public.profiles
SET 
  tokens = 1000,
  ad_watch_count = 0,
  joined_topics = '{}',
  created_topics = '{}';

-- 選項 B: 刪除所有用戶資料（慎用！）
-- DELETE FROM public.profiles;

-- ==========================================
-- 5. 清理其他測試資料
-- ==========================================

-- 清理 UI 文字（保留系統預設）
DELETE FROM public.ui_texts WHERE key LIKE 'test%';

-- 清理測試公告
DELETE FROM public.announcements WHERE title LIKE '%測試%';

-- ==========================================
-- 6. 驗證清理結果
-- ==========================================

SELECT 
  '✅ 資料庫清理完成！' as status,
  '=' as separator,
  (SELECT COUNT(*) FROM public.profiles) as "用戶數",
  (SELECT COUNT(*) FROM public.topics) as "主題數",
  (SELECT COUNT(*) FROM public.free_votes) as "免費投票數",
  (SELECT COUNT(*) FROM public.votes) as "代幣投票數",
  (SELECT COUNT(*) FROM public.token_transactions) as "交易記錄數",
  (SELECT COUNT(*) FROM public.user_missions) as "任務進度數",
  (SELECT COUNT(*) FROM public.audit_logs) as "審計日誌數",
  (SELECT COUNT(*) FROM public.reports) as "檢舉記錄數",
  (SELECT SUM(tokens) FROM public.profiles) as "總代幣數";


