-- Create report system

-- Create report_types enum
CREATE TYPE public.report_type AS ENUM (
  'hate_speech',      -- 仇恨言論
  'sexual_content',   -- 色情內容
  'violence',         -- 暴力內容
  'illegal',          -- 違法內容
  'spam',             -- 垃圾訊息
  'phishing',         -- 釣魚詐騙
  'misinformation',   -- 虛假訊息
  'harassment',       -- 騷擾
  'other'             -- 其他
);

-- Create report_status enum
CREATE TYPE public.report_status AS ENUM (
  'pending',          -- 待處理
  'reviewing',        -- 審核中
  'resolved',         -- 已處理
  'rejected',         -- 已駁回
  'closed'            -- 已關閉
);

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_email TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('topic', 'user', 'comment')),
  target_id UUID NOT NULL,
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
  
  -- Prevent duplicate reports from same user for same target
  CONSTRAINT unique_user_target_report UNIQUE (reporter_id, target_type, target_id, report_type)
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies for reports
-- Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- Users can insert reports (authenticated or anonymous)
CREATE POLICY "Users can insert reports"
  ON public.reports FOR INSERT
  WITH CHECK (true);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON public.reports FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admins can update reports
CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Admins can delete reports
CREATE POLICY "Admins can delete reports"
  ON public.reports FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.reports(created_at DESC);

-- Function to get report statistics
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
    COUNT(*)::BIGINT as total_reports,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_reports,
    COUNT(*) FILTER (WHERE status = 'reviewing')::BIGINT as reviewing_reports,
    COUNT(*) FILTER (WHERE status = 'resolved')::BIGINT as resolved_reports,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_reports
  FROM public.reports;
END;
$$;

-- Function to get reports with target details
CREATE OR REPLACE FUNCTION public.get_reports_with_details(
  p_status public.report_status DEFAULT NULL,
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
  RETURN QUERY
  SELECT 
    r.id,
    r.reporter_id,
    r.reporter_email,
    r.target_type,
    r.target_id,
    CASE 
      WHEN r.target_type = 'topic' THEN (SELECT t.title FROM public.topics t WHERE t.id = r.target_id)
      WHEN r.target_type = 'user' THEN (SELECT p.username FROM public.profiles p WHERE p.id = r.target_id)
      ELSE NULL
    END as target_title,
    r.report_type,
    r.reason,
    r.details,
    r.status,
    r.reviewed_by,
    r.reviewed_at,
    r.admin_notes,
    r.resolution,
    r.created_at,
    r.updated_at
  FROM public.reports r
  WHERE (p_status IS NULL OR r.status = p_status)
  ORDER BY 
    CASE 
      WHEN r.status = 'pending' THEN 1
      WHEN r.status = 'reviewing' THEN 2
      WHEN r.status = 'resolved' THEN 3
      WHEN r.status = 'rejected' THEN 4
      ELSE 5
    END,
    r.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to update report status
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

-- Create trigger for updated_at
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add system config for report settings
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('report_email_notifications', 'true', 'report', '是否發送檢舉郵件通知給管理員'),
  ('report_admin_email', 'admin@votechaos.com', 'report', '接收檢舉通知的管理員郵箱'),
  ('report_auto_hide_threshold', '5', 'report', '自動隱藏內容的檢舉數量閾值'),
  ('report_require_auth', 'false', 'report', '檢舉是否需要登入')
ON CONFLICT (key) DO NOTHING;

-- Insert sample report types explanation (for UI reference)
COMMENT ON TYPE public.report_type IS 'Report type categories: hate_speech, sexual_content, violence, illegal, spam, phishing, misinformation, harassment, other';
COMMENT ON TYPE public.report_status IS 'Report status: pending, reviewing, resolved, rejected, closed';

