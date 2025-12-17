-- ========================================
-- 修正 Supabase Database Linter：
-- 1) public schema 表格未啟用 RLS
-- 2) functions search_path 可變（未設定）
--
-- 注意：
-- - 本 migration 以「不破壞既有功能」為前提：
--   - exposure_limits 需要前台讀取 → 允許 SELECT
--   - exposure_* 統計/違規表：允許使用者讀自己、管理員全權
--   - login_seed_tracker / feedback：預設僅管理員可存取（避免外部洩漏）
-- ========================================

-- ----------------------------
-- 1) 啟用 RLS（tables）
-- ----------------------------
ALTER TABLE IF EXISTS public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.login_seed_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_exposure_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exposure_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exposure_limits ENABLE ROW LEVEL SECURITY;

-- ----------------------------
-- 2) RLS Policies
-- ----------------------------

-- 2.1 exposure_limits：前台需要讀取方案
DROP POLICY IF EXISTS "Anyone can view exposure limits" ON public.exposure_limits;
CREATE POLICY "Anyone can view exposure limits"
  ON public.exposure_limits FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert exposure limits" ON public.exposure_limits;
CREATE POLICY "Admins can insert exposure limits"
  ON public.exposure_limits FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update exposure limits" ON public.exposure_limits;
CREATE POLICY "Admins can update exposure limits"
  ON public.exposure_limits FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete exposure limits" ON public.exposure_limits;
CREATE POLICY "Admins can delete exposure limits"
  ON public.exposure_limits FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 2.2 user_exposure_stats：使用者只能看/寫自己的統計
DROP POLICY IF EXISTS "Users can view own exposure stats" ON public.user_exposure_stats;
CREATE POLICY "Users can view own exposure stats"
  ON public.user_exposure_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own exposure stats" ON public.user_exposure_stats;
CREATE POLICY "Users can insert own exposure stats"
  ON public.user_exposure_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own exposure stats" ON public.user_exposure_stats;
CREATE POLICY "Users can update own exposure stats"
  ON public.user_exposure_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all exposure stats" ON public.user_exposure_stats;
CREATE POLICY "Admins can view all exposure stats"
  ON public.user_exposure_stats FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 2.3 exposure_violations：使用者只能看自己的違規；管理員可管理
DROP POLICY IF EXISTS "Users can view own exposure violations" ON public.exposure_violations;
CREATE POLICY "Users can view own exposure violations"
  ON public.exposure_violations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage exposure violations" ON public.exposure_violations;
CREATE POLICY "Admins can manage exposure violations"
  ON public.exposure_violations FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 2.4 login_seed_tracker：測試/內部用，僅管理員
DROP POLICY IF EXISTS "Admins can manage login_seed_tracker" ON public.login_seed_tracker;
CREATE POLICY "Admins can manage login_seed_tracker"
  ON public.login_seed_tracker FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 2.5 feedback：目前未在前端直接使用，先鎖管理員（避免外部存取）
DROP POLICY IF EXISTS "Admins can manage feedback" ON public.feedback;
CREATE POLICY "Admins can manage feedback"
  ON public.feedback FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------
-- 3) 修正 functions search_path（避免 mutable search_path）
-- ----------------------------
-- 說明：不重寫函數內容，改用 ALTER FUNCTION 設定 search_path，降低風險。

-- 注意：PostgreSQL 不支援 `ALTER FUNCTION IF EXISTS ...` 語法
-- 這裡用 to_regprocedure(...) 判斷函數存在才執行 ALTER，避免因缺函數導致 migration 失敗

DO $$
BEGIN
  -- core timestamps
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at() SET search_path TO public';
  END IF;

  -- announcements
  IF to_regprocedure('public.get_active_announcements(integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_active_announcements(integer) SET search_path TO public';
  END IF;

  -- banned words / validation
  IF to_regprocedure('public.check_banned_words(text, text[])') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.check_banned_words(text, text[]) SET search_path TO public';
  END IF;

  IF to_regprocedure('public.validate_topic_content(text, text, jsonb, text[], text, text[])') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.validate_topic_content(text, text, jsonb, text[], text, text[]) SET search_path TO public';
  END IF;

  -- exposure system functions
  IF to_regprocedure('public.update_exposure_updated_at()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.update_exposure_updated_at() SET search_path TO public';
  END IF;

  IF to_regprocedure('public.expire_old_exposure_applications()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.expire_old_exposure_applications() SET search_path TO public';
  END IF;

  IF to_regprocedure('public.get_exposure_weight(text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_exposure_weight(text) SET search_path TO public';
  END IF;

  IF to_regprocedure('public.can_apply_exposure(uuid, text, uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.can_apply_exposure(uuid, text, uuid) SET search_path TO public';
  END IF;

  IF to_regprocedure('public.apply_exposure(uuid, text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.apply_exposure(uuid, text) SET search_path TO public';
  END IF;

  IF to_regprocedure('public.get_topic_exposure_score(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_topic_exposure_score(uuid) SET search_path TO public';
  END IF;

  IF to_regprocedure('public.get_hot_topics_with_exposure(integer, integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_hot_topics_with_exposure(integer, integer) SET search_path TO public';
  END IF;

  IF to_regprocedure('public.get_latest_topics_with_exposure(integer, integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_latest_topics_with_exposure(integer, integer) SET search_path TO public';
  END IF;

  IF to_regprocedure('public.reset_daily_exposure_stats()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.reset_daily_exposure_stats() SET search_path TO public';
  END IF;

  IF to_regprocedure('public.check_exposure_violations()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.check_exposure_violations() SET search_path TO public';
  END IF;

  IF to_regprocedure('public.get_user_exposure_status(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_user_exposure_status(uuid) SET search_path TO public';
  END IF;

  -- security warn trigger (if exists)
  IF to_regprocedure('public.warn_direct_options_update()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.warn_direct_options_update() SET search_path TO public';
  END IF;
END $$;


