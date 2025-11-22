-- 更新通知類型檢核，加入客服回覆類別
BEGIN;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('announcement', 'personal', 'system', 'contact'));

-- 將既有的客服回覆通知改為新類別
UPDATE public.notifications
SET type = 'contact'
WHERE type = 'personal'
  AND title = '客服回覆';

NOTIFY pgrst, 'reload schema';

COMMIT;



