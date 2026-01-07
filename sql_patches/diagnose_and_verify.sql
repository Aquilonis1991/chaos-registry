-- =================================================================
-- DIAGNOSE LOCKS & VERIFICATION
-- Run this to check if the table is locked and if we can read it.
-- =================================================================

-- 1. Check for Active Locks on admin_users
SELECT 
    a.pid, 
    a.usename, 
    pg_blocking_pids(a.pid) as blocked_by, 
    a.query as blocked_query,
    a.state,
    l.mode as lock_mode,
    l.granted
FROM pg_stat_activity a
JOIN pg_locks l ON l.pid = a.pid
WHERE l.relation = 'public.admin_users'::regclass;

-- 2. Try a simple SELECT (If this hangs, the table is definitely locked)
-- We set a local timeout so this script doesn't hang forever
SET statement_timeout = '2s';

DO $$
DECLARE
    row_count int;
    is_adm boolean;
BEGIN
    RAISE NOTICE 'Attempting to read admin_users...';
    SELECT count(*) INTO row_count FROM public.admin_users;
    RAISE NOTICE 'Success! admin_users count: %', row_count;
    
    RAISE NOTICE 'Attempting public.is_admin...';
    SELECT public.is_admin('08fc94c1-bfb3-47ed-9191-b46fa24837f2') INTO is_adm;
    RAISE NOTICE 'Success! is_admin result: %', is_adm;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Read Failed or Timed Out! Error: %', SQLERRM;
END $$;

-- Reset timeout
SET statement_timeout = 0;
