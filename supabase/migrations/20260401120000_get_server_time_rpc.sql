-- 供前端同步「伺服器當下時間」，避免使用者調整裝置時鐘影響 UI 判定（權威仍為 DB now()）
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clock_timestamp();
$$;

COMMENT ON FUNCTION public.get_server_time() IS 'Returns current database timestamp for client clock offset sync.';

GRANT EXECUTE ON FUNCTION public.get_server_time() TO anon, authenticated;
