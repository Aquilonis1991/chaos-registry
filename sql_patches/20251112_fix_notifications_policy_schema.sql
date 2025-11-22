-- 修正 notifications 表的管理員 SELECT 策略，確保使用 public.is_admin
BEGIN;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view notifications" ON public.notifications;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'notifications'
      AND policyname = 'Admins can view notifications'
  ) THEN
    CREATE POLICY "Admins can view notifications"
      ON public.notifications
      FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

