-- Fix performance/recursion issues with is_admin
-- Defines is_admin as SECURITY DEFINER to bypass RLS recursion loops
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Run as owner to bypass RLS recursion
SET search_path = public, extensions, pg_temp -- Security best practice
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = check_user_id
  );
$$;

-- Ensure admin_users has a simple policy that doesn't cause recursion for the user themselves
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Allow users to read THEIR OWN admin status (this is safe and simple)
DROP POLICY IF EXISTS "Users can read own admin status" ON public.admin_users;
CREATE POLICY "Users can read own admin status" ON public.admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Explicitly allow service_role FULL access
DROP POLICY IF EXISTS "Service role full access" ON public.admin_users;
CREATE POLICY "Service role full access" ON public.admin_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- And for good measure, allow admins to read all admin users (if needed), 
-- but ensure we use the SECURITY DEFINER function to avoid recursion
DROP POLICY IF EXISTS "Admins can read all admin users" ON public.admin_users;
CREATE POLICY "Admins can read all admin users" ON public.admin_users
  FOR SELECT
  USING (is_admin(auth.uid()));
