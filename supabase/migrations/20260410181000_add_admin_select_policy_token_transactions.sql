-- Allow admins to view all token transaction rows in admin backend.
-- Without this policy, admin UI queries to token_transactions are filtered by user_id = auth.uid().

ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all token transactions" ON public.token_transactions;
CREATE POLICY "Admins can view all token transactions"
ON public.token_transactions
FOR SELECT
USING (public.is_admin(auth.uid()));

NOTIFY pgrst, 'reload schema';
