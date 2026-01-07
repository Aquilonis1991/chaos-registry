-- =================================================================
-- FORCE KILL LOCKS & APPLY ADMIN FIX
-- Use this if the previous fix script is executing successfully but not resolving the issue, 
-- or if the previous script hangs/timeouts.
-- =================================================================

-- 1. TERMINATE STUCK QUERIES
-- This kills any active queries that might be locking 'admin_users'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT pid, query
        FROM pg_stat_activity
        WHERE state = 'active'
        AND pid <> pg_backend_pid() -- Don't kill myself
        -- Target queries touching admin_users or is_admin
        AND (query ILIKE '%public.admin_users%' OR query ILIKE '%is_admin%')
    LOOP
        RAISE NOTICE 'Killing PID % running query: %', r.pid, left(r.query, 50);
        PERFORM pg_terminate_backend(r.pid);
    END LOOP;
    
    -- Sleep briefly to let locks release
    PERFORM pg_sleep(1);
END $$;

-- 2. NOW APPLY THE FIX (Same as nuclear fix, but guarenteed to run on unlocked table)

-- Disable RLS
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies
DROP POLICY IF EXISTS "Users can read own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can read all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Service role full access" ON public.admin_users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.admin_users;
DROP POLICY IF EXISTS "Enable insert for service role only" ON public.admin_users;
DROP POLICY IF EXISTS "Allow service role to do everything" ON public.admin_users;

-- Re-enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Add ONLY safe, non-recursive policies
CREATE POLICY "Users can read own admin status" ON public.admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.admin_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Redefine is_admin safely
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = check_user_id
  );
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

-- 3. VERIFICATION
-- This should run instantly now
DO $$
DECLARE
    v_is_admin boolean;
BEGIN
    SELECT public.is_admin('08fc94c1-bfb3-47ed-9191-b46fa24837f2') INTO v_is_admin;
    RAISE NOTICE 'Verification Result: is_admin = %', v_is_admin;
END $$;
