
-- CRITICAL SECURITY FIX
-- Revoke execution of add_tokens from standard users.
-- Only Service Role (Edge Functions) should be able to mint tokens.

REVOKE EXECUTE ON FUNCTION public.add_tokens(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_tokens(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.add_tokens(uuid, integer) FROM anon;

-- Explicitly grant to service_role (just in case)
GRANT EXECUTE ON FUNCTION public.add_tokens(uuid, integer) TO service_role;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
