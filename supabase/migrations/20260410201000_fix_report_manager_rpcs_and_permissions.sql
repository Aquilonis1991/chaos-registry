-- Fix report manager RPC failures and align admin permissions.
-- Root cause fixed: old get_reports_with_details referenced profiles.username.

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports"
ON public.reports
FOR SELECT
USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can insert reports" ON public.reports;
CREATE POLICY "Users can insert reports"
ON public.reports
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports"
ON public.reports
FOR SELECT
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
ON public.reports
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete reports" ON public.reports;
CREATE POLICY "Admins can delete reports"
ON public.reports
FOR DELETE
USING (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reports TO authenticated;
GRANT ALL ON TABLE public.reports TO service_role;

DROP FUNCTION IF EXISTS public.get_reports_with_details(public.report_status, integer, integer);
DROP FUNCTION IF EXISTS public.get_reports_with_details(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_reports_with_details(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  reporter_id uuid,
  reporter_email text,
  target_type text,
  target_id uuid,
  target_title text,
  report_type public.report_type,
  reason text,
  details text,
  status public.report_status,
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  resolution text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_status public.report_status;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: You do not have admin privileges.';
  END IF;

  IF p_status IS NULL OR btrim(p_status) = '' THEN
    RETURN QUERY
    SELECT
      r.id,
      r.reporter_id,
      COALESCE(r.reporter_email, '')::text AS reporter_email,
      r.target_type,
      r.target_id,
      CASE
        WHEN r.target_type = 'topic' THEN (SELECT t.title FROM public.topics t WHERE t.id = r.target_id)
        WHEN r.target_type = 'user' THEN (SELECT p.nickname FROM public.profiles p WHERE p.id = r.target_id)
        ELSE NULL
      END AS target_title,
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
    ORDER BY r.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  ELSE
    v_status := p_status::public.report_status;

    RETURN QUERY
    SELECT
      r.id,
      r.reporter_id,
      COALESCE(r.reporter_email, '')::text AS reporter_email,
      r.target_type,
      r.target_id,
      CASE
        WHEN r.target_type = 'topic' THEN (SELECT t.title FROM public.topics t WHERE t.id = r.target_id)
        WHEN r.target_type = 'user' THEN (SELECT p.nickname FROM public.profiles p WHERE p.id = r.target_id)
        ELSE NULL
      END AS target_title,
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
    WHERE r.status = v_status
    ORDER BY r.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_report_stats()
RETURNS TABLE (
  total_reports bigint,
  pending_reports bigint,
  reviewing_reports bigint,
  resolved_reports bigint,
  rejected_reports bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: You do not have admin privileges.';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_reports,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending_reports,
    COUNT(*) FILTER (WHERE status = 'reviewing')::bigint AS reviewing_reports,
    COUNT(*) FILTER (WHERE status = 'resolved')::bigint AS resolved_reports,
    COUNT(*) FILTER (WHERE status = 'rejected')::bigint AS rejected_reports
  FROM public.reports;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_report_status(
  p_report_id uuid,
  p_status public.report_status,
  p_admin_notes text DEFAULT NULL,
  p_resolution text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: You do not have admin privileges.';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_reports_with_details(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_report_status(uuid, public.report_status, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
