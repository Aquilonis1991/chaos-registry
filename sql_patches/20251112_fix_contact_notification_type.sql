-- 完整修正：將客服回覆通知獨立為 'contact' 類別
-- 此腳本會：
-- 1. 檢查並更新 notifications.type 的 CHECK 約束，加入 'contact' 類型
-- 2. 將所有標題為「客服回覆」的個人通知改為 'contact' 類型
-- 3. 確保 admin_reply_contact_message 函數正確發送 'contact' 類型通知

BEGIN;

-- 步驟 1: 移除所有可能的 type 約束（處理不同命名情況）
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- 查找所有與 type 相關的 CHECK 約束
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
      AND conname LIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

-- 步驟 2: 重新建立包含 'contact' 的 CHECK 約束
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('announcement', 'personal', 'system', 'contact'));

-- 步驟 3: 更新所有標題為「客服回覆」的個人通知為 'contact' 類型
UPDATE public.notifications
SET type = 'contact'
WHERE type = 'personal'
  AND (title = '客服回覆' OR title LIKE '%客服回覆%');

-- 步驟 4: 驗證約束已正確建立
DO $$
DECLARE
  constraint_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND conname = 'notifications_type_check'
      AND contype = 'c'
  ) INTO constraint_exists;

  IF NOT constraint_exists THEN
    RAISE EXCEPTION '約束 notifications_type_check 建立失敗';
  END IF;

  RAISE NOTICE '約束 notifications_type_check 已成功建立，支援類型: announcement, personal, system, contact';
END $$;

-- 步驟 5: 通知 PostgREST 重新載入 schema
NOTIFY pgrst, 'reload schema';

COMMIT;

-- 驗證查詢（可選，用於確認結果）
-- SELECT type, COUNT(*) as count
-- FROM public.notifications
-- GROUP BY type
-- ORDER BY type;

