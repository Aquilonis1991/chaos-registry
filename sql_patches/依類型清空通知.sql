-- 依類型清空通知的 SQL 腳本
-- 可以選擇要清空的類型：'announcement', 'personal', 'contact', 'system'
-- 使用方式：修改下方的 v_types_to_clear 陣列

BEGIN;

DO $$
DECLARE
  -- 設定要清空的類型（可多選）
  -- 範例：只清空公告和個人通知
  -- v_types_to_clear text[] := ARRAY['announcement', 'personal'];
  -- 範例：只清空公告
  -- v_types_to_clear text[] := ARRAY['announcement'];
  -- 範例：清空所有類型
  v_types_to_clear text[] := ARRAY['announcement', 'personal', 'contact', 'system'];
  
  deleted_count integer;
  type_item text;
  type_count integer;
BEGIN
  -- 顯示刪除前的統計
  RAISE NOTICE '刪除前的統計：';
  FOR type_item IN SELECT unnest(v_types_to_clear)
  LOOP
    SELECT COUNT(*) INTO type_count
    FROM public.notifications
    WHERE type = type_item;
    RAISE NOTICE '  %：%', type_item, type_count;
  END LOOP;

  -- 執行刪除
  DELETE FROM public.notifications
  WHERE type = ANY(v_types_to_clear);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE '已刪除 % 筆記錄', deleted_count;
END $$;

COMMIT;

-- 驗證查詢（可選）
-- SELECT type, COUNT(*) as count
-- FROM public.notifications
-- GROUP BY type
-- ORDER BY type;

