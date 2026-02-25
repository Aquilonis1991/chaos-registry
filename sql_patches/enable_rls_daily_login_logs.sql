-- ========================================
-- Enable RLS on public.daily_login_logs
-- Fixes linter: rls_disabled_in_public (SECURITY)
-- ========================================
-- 此表由 RPC record_daily_login (SECURITY DEFINER) 寫入，前端不直接存取。
-- 啟用 RLS 後僅允許已登入用戶讀取自己的紀錄；寫入仍僅能透過 RPC。

ALTER TABLE IF EXISTS public.daily_login_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own daily login logs" ON public.daily_login_logs;
-- 已登入用戶僅可讀取自己的每日登入紀錄（前端目前透過 RPC 取得資料，此 policy 供日後若需直接查詢時仍安全）
CREATE POLICY "Users can read own daily login logs"
  ON public.daily_login_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 不開放 INSERT/UPDATE/DELETE 給 anon/authenticated，寫入僅能透過 record_daily_login RPC (SECURITY DEFINER)
