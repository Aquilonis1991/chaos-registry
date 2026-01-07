-- EMERGENCY FIX: Remove Recursive RLS Policy
-- The policy "Only admins can view all admin records" calls public.is_admin()
-- public.is_admin() queries the admin_users table.
-- This creates a potential infinite loop/deadlock, causing queries to time out (15s).

-- 1. Drop the problematic recursive policy
DROP POLICY IF EXISTS "Only admins can view all admin records" ON public.admin_users;

-- 2. Ensure the safe "view own" policy exists
DROP POLICY IF EXISTS "Users can view own admin status" ON public.admin_users;
CREATE POLICY "Users can view own admin status"
ON public.admin_users
FOR SELECT
USING (user_id = auth.uid());

-- 3. (Optional) If we really need admins to view all, we should use a separate "admin_view" or rely on Service Role.
-- For now, we prioritize ACCESS. 

-- 4. Refresh is_admin just in case
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_users 
    WHERE user_id = check_user_id
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;
