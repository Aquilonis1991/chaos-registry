-- 允許管理員在後台讀取所有通知紀錄
BEGIN;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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



