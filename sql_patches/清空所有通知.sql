-- 清空所有公告及通知的 SQL 腳本
-- 警告：此腳本會刪除 notifications 表中的所有記錄
-- 執行前請確認是否需要備份資料

BEGIN;

-- 顯示刪除前的統計資訊
DO $$
DECLARE
  total_count integer;
  announcement_count integer;
  personal_count integer;
  contact_count integer;
  system_count integer;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.notifications;
  SELECT COUNT(*) INTO announcement_count FROM public.notifications WHERE type = 'announcement';
  SELECT COUNT(*) INTO personal_count FROM public.notifications WHERE type = 'personal';
  SELECT COUNT(*) INTO contact_count FROM public.notifications WHERE type = 'contact';
  SELECT COUNT(*) INTO system_count FROM public.notifications WHERE type = 'system';

  RAISE NOTICE '刪除前的統計：';
  RAISE NOTICE '  總數：%', total_count;
  RAISE NOTICE '  公告：%', announcement_count;
  RAISE NOTICE '  個人通知：%', personal_count;
  RAISE NOTICE '  客服回覆：%', contact_count;
  RAISE NOTICE '  系統通知：%', system_count;
END $$;

-- 刪除所有通知
DELETE FROM public.notifications;

-- 顯示刪除後的統計資訊
DO $$
DECLARE
  remaining_count integer;
BEGIN
  SELECT COUNT(*) INTO remaining_count FROM public.notifications;
  RAISE NOTICE '刪除完成，剩餘記錄數：%', remaining_count;
END $$;

COMMIT;

-- 驗證查詢（可選）
-- SELECT type, COUNT(*) as count
-- FROM public.notifications
-- GROUP BY type
-- ORDER BY type;

