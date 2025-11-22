-- 修正客服回覆通知類型
-- 確保所有標題為「客服回覆」的通知都被標記為 'contact' 類型，而不是 'personal'

BEGIN;

-- 更新所有標題包含「客服回覆」的通知為 'contact' 類型
UPDATE public.notifications
SET type = 'contact'
WHERE (title = '客服回覆' OR title LIKE '%客服回覆%')
  AND type != 'contact';

-- 顯示更新結果
DO $$
DECLARE
  updated_count integer;
  remaining_personal_count integer;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  SELECT COUNT(*) INTO remaining_personal_count
  FROM public.notifications
  WHERE (title = '客服回覆' OR title LIKE '%客服回覆%')
    AND type = 'personal';
  
  RAISE NOTICE '已更新 % 筆通知為 contact 類型', updated_count;
  
  IF remaining_personal_count > 0 THEN
    RAISE NOTICE '警告：仍有 % 筆標題為「客服回覆」的通知類型為 personal', remaining_personal_count;
  END IF;
END $$;

-- 驗證查詢（可選）
-- SELECT type, COUNT(*) as count
-- FROM public.notifications
-- WHERE title LIKE '%客服回覆%' OR title = '客服回覆'
-- GROUP BY type;

COMMIT;

