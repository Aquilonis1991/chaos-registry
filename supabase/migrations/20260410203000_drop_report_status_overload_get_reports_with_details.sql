-- Resolve PostgREST RPC ambiguity for get_reports_with_details.
-- Keep only text overload.

DROP FUNCTION IF EXISTS public.get_reports_with_details(public.report_status, integer, integer);

NOTIFY pgrst, 'reload schema';
