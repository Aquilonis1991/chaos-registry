-- =================================================================
-- VERIFY ADMIN ACCESS SPEED
-- Run this to see if the query returns instantly or hangs.
-- =================================================================

-- 1. Test is_admin RPC directly
SELECT public.is_admin('08fc94c1-bfb3-47ed-9191-b46fa24837f2') as is_admin_rpc_result;

-- 2. Test direct table access (simulating the client query)
-- If RLS is broken/recursive, this COUNT might hang or return error.
SELECT count(*) as total_admins FROM public.admin_users;

-- 3. Test RLS specifically for this user (simulate session)
-- Note: This is an approximation since we are running as postgres/admin in SQL Editor usually.
SELECT * FROM public.admin_users WHERE id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2';
