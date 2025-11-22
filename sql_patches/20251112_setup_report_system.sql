-- 建立 / 更新檢舉系統所需的 enum、資料表與函式
-- 使用方式：在 Supabase SQL Editor 執行整份腳本

BEGIN;

-- 1. 建立檢舉類型 enum（若尚未存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'report_type'
  ) THEN
    CREATE TYPE public.report_type AS ENUM (
      'hate_speech',
      'sexual_content',
      'violence',
      'illegal',
      'spam',
      'phishing',
      'misinformation',
      'harassment',
      'other'
    );
  END IF;
END $$;

-- 2. 建立檢舉狀態 enum（若尚未存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'report_status'
  ) THEN
    CREATE TYPE public.report_status AS ENUM (
      'pending',
      'reviewing',
      'resolved',
      'rejected',
      'closed'
    );
  END IF;
END $$;

-- 3. 建立 reports 資料表（若尚未存在），並補齊必要欄位
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_email TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('topic', 'user', 'comment')),
  target_id UUID,
  report_type public.report_type NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) <= 500),
  details TEXT CHECK (char_length(details) <= 2000),
  status public.report_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_target_report UNIQUE (reporter_id, target_type, target_id, report_type)
);

-- 若資料表已存在但缺欄位，可在此視需求補齊（範例）
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reporter_email TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolution TEXT;

-- 4. 啟用 RLS 並建立基本 policy（自行調整實際權限需求）
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can insert reports'
  ) THEN
    CREATE POLICY "Users can insert reports"
      ON public.reports FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can view own reports'
  ) THEN
    CREATE POLICY "Users can view own reports"
      ON public.reports FOR SELECT
      USING (auth.uid() = reporter_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Admins can view all reports'
  ) THEN
    CREATE POLICY "Admins can view all reports"
      ON public.reports FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Admins can update reports'
  ) THEN
    CREATE POLICY "Admins can update reports"
      ON public.reports FOR UPDATE
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Admins can delete reports'
  ) THEN
    CREATE POLICY "Admins can delete reports"
      ON public.reports FOR DELETE
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- 5. 建立 / 更新各項函式

-- 5-1. 檢舉統計函式
CREATE OR REPLACE FUNCTION public.get_report_stats()
RETURNS TABLE (
  total_reports BIGINT,
  pending_reports BIGINT,
  reviewing_reports BIGINT,
  resolved_reports BIGINT,
  rejected_reports BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_reports,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT AS pending_reports,
    COUNT(*) FILTER (WHERE status = 'reviewing')::BIGINT AS reviewing_reports,
    COUNT(*) FILTER (WHERE status = 'resolved')::BIGINT AS resolved_reports,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT AS rejected_reports
  FROM public.reports;
END;
$$;

DROP FUNCTION IF EXISTS public.get_reports_with_details(public.report_status, integer, integer);
DROP FUNCTION IF EXISTS public.get_reports_with_details(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_reports_with_details(
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  reporter_id UUID,
  reporter_email TEXT,
  target_type TEXT,
  target_id UUID,
  target_title TEXT,
  report_type public.report_type,
  reason TEXT,
  details TEXT,
  status public.report_status,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status IS NULL OR trim(p_status) = '' THEN
    RETURN QUERY
    SELECT
      r.id,
      r.reporter_id,
      COALESCE(r.reporter_email, '')::TEXT AS reporter_email,
      r.target_type,
      r.target_id,
      CASE
        WHEN r.target_type = 'topic' THEN (
          SELECT t.title FROM public.topics t WHERE t.id = r.target_id
        )
        WHEN r.target_type = 'user' THEN (
          SELECT p.nickname FROM public.profiles p WHERE p.id = r.target_id
        )
        ELSE NULL
      END AS target_title,
      CAST(r.report_type AS public.report_type) AS report_type,
      r.reason,
      r.details,
      CAST(r.status AS public.report_status) AS status,
      r.reviewed_by,
      r.reviewed_at,
      r.admin_notes,
      r.resolution,
      r.created_at,
      r.updated_at
    FROM public.reports r
    ORDER BY r.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  ELSE
    RETURN QUERY
    SELECT
      r.id,
      r.reporter_id,
      COALESCE(r.reporter_email, '')::TEXT AS reporter_email,
      r.target_type,
      r.target_id,
      CASE
        WHEN r.target_type = 'topic' THEN (
          SELECT t.title FROM public.topics t WHERE t.id = r.target_id
        )
        WHEN r.target_type = 'user' THEN (
          SELECT p.nickname FROM public.profiles p WHERE p.id = r.target_id
        )
        ELSE NULL
      END AS target_title,
      CAST(r.report_type AS public.report_type) AS report_type,
      r.reason,
      r.details,
      CAST(r.status AS public.report_status) AS status,
      r.reviewed_by,
      r.reviewed_at,
      r.admin_notes,
      r.resolution,
      r.created_at,
      r.updated_at
    FROM public.reports r
    WHERE r.status = p_status::public.report_status
    ORDER BY r.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

-- 5-3. 更新檢舉狀態函式（若尚未存在，視需要調整）
CREATE OR REPLACE FUNCTION public.update_report_status(
  p_report_id UUID,
  p_status public.report_status,
  p_admin_notes TEXT DEFAULT NULL,
  p_resolution TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reports
  SET 
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    resolution = COALESCE(p_resolution, resolution),
    updated_at = now()
  WHERE id = p_report_id;
END;
$$;

-- 6. 建立 updated_at 觸發器（若尚未存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_reports_updated_at'
  ) THEN
    CREATE TRIGGER update_reports_updated_at
      BEFORE UPDATE ON public.reports
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- 7. 重新整理 schema cache，讓 Supabase 立即感知最新函式
NOTIFY pgrst, 'reload schema';

COMMIT;
