-- =================================================================
-- Nuclear Fix for Admin Access Timeout (RLS Recursion)
-- =================================================================

-- 1. Disable RLS temporarily to reset policies safely
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL policies to ensure no recursive 'is_admin' calls remain
-- We explicitly drop every known policy name to be sure
DROP POLICY IF EXISTS "Users can read own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can read all admin users" ON public.admin_users; -- THE CULPRIT
DROP POLICY IF EXISTS "Service role full access" ON public.admin_users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.admin_users;
DROP POLICY IF EXISTS "Enable insert for service role only" ON public.admin_users;

-- 3. Re-enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 4. Add ONLY safe, non-recursive policies

-- Policy A: Users can ONLY read their own row.
-- This is extremely fast (Index Scan on PK/Unique) and cannot recurse.
CREATE POLICY "Users can read own admin status" ON public.admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy B: Service Role has full access.
-- Service Role bypasses RLS anyway, but this is explicit.
CREATE POLICY "Service role full access" ON public.admin_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- NOTE: We intentionally DO NOT add a policy for "Admins can read all admins".
-- That policy traditionally calls is_admin(), which queries admin_users, triggering the policy again -> Recursion.
-- If the UI needs to list all admins, it should use a dedicated RPC or Supabase Dashboard.

-- 5. Redefine is_admin just to be absolutely sure it's SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Critical: Run as Owner to bypass RLS
SET search_path = public, extensions, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = check_user_id
  );
$$;

-- 6. Grant execute permissions explicitly
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
