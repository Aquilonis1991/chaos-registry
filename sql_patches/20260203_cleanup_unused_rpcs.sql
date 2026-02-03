-- Cleanup Unused RPC Versions
-- Now that V5 (Safe Mode) is working, we can safely remove the failed attempts.

-- V1 & V2: Signature mismatch issues
DROP FUNCTION IF EXISTS public.get_profiles_with_email_for_admin(text, int, int);
DROP FUNCTION IF EXISTS public.get_profiles_with_email_for_admin_v2(text, int, int);

-- V3: JSON payload (Supabase type issues)
DROP FUNCTION IF EXISTS public.get_profiles_with_email_for_admin_v3(json);

-- V4: String params (Schema mismatch issues)
DROP FUNCTION IF EXISTS public.get_admin_user_list(text, text, text);

-- Final verification: Reload schema one last time to be clean
NOTIFY pgrst, 'reload config';
