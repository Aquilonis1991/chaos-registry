-- Fix admin write access for banned_words manager.
-- Some environments created banned_words via manual SQL and may miss grants/policies.

ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;

-- Recreate policies idempotently.
DROP POLICY IF EXISTS "Anyone can view banned words" ON public.banned_words;
CREATE POLICY "Anyone can view banned words"
ON public.banned_words
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Only admins can insert banned words" ON public.banned_words;
CREATE POLICY "Only admins can insert banned words"
ON public.banned_words
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can update banned words" ON public.banned_words;
CREATE POLICY "Only admins can update banned words"
ON public.banned_words
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can delete banned words" ON public.banned_words;
CREATE POLICY "Only admins can delete banned words"
ON public.banned_words
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Ensure table-level privileges exist for authenticated role.
GRANT SELECT ON TABLE public.banned_words TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.banned_words TO authenticated;
GRANT ALL ON TABLE public.banned_words TO service_role;

-- Ensure CSV import RPC is callable by admins through authenticated role.
GRANT EXECUTE ON FUNCTION public.import_banned_words_from_csv(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_banned_words_from_csv(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
