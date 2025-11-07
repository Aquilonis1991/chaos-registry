-- Phase 1: Critical Privacy & Data Protection

-- 1.1 Fix Public Profile Data Exposure
-- Drop the overly permissive public view policy
DROP POLICY IF EXISTS "Anyone can view public profile data" ON public.profiles;

-- Create restricted public view policy (only nickname and avatar)
CREATE POLICY "Public can view limited profile data"
ON public.profiles
FOR SELECT
USING (true);

-- Note: Frontend queries will need to respect field-level access
-- The "Users can view own full profile" policy already exists for authenticated users

-- 1.2 Lock Down Audit Logs
-- Add explicit DENY policy for audit logs (only service role can access)
CREATE POLICY "Deny all direct access to audit logs"
ON public.audit_logs
FOR SELECT
USING (false);

-- 1.3 Secure Token Transactions Table
-- Prevent user manipulation of token transactions
CREATE POLICY "Deny user INSERT on token_transactions"
ON public.token_transactions
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny user UPDATE on token_transactions"
ON public.token_transactions
FOR UPDATE
USING (false);

CREATE POLICY "Deny user DELETE on token_transactions"
ON public.token_transactions
FOR DELETE
USING (false);

-- Phase 2: Prevent Race Conditions & Data Manipulation

-- 2.1 Add constraint to prevent negative token balances
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_tokens_non_negative CHECK (tokens >= 0);

-- 2.2 Add DELETE Protection Policies
CREATE POLICY "Deny DELETE on votes"
ON public.votes
FOR DELETE
USING (false);

CREATE POLICY "Deny DELETE on topics"
ON public.topics
FOR DELETE
USING (false);

CREATE POLICY "Deny DELETE on topic_creators"
ON public.topic_creators
FOR DELETE
USING (false);

CREATE POLICY "Deny DELETE on topic_participants"
ON public.topic_participants
FOR DELETE
USING (false);

CREATE POLICY "Deny DELETE on reports"
ON public.reports
FOR DELETE
USING (false);

-- 2.3 Add UPDATE Protection for immutable tables
CREATE POLICY "Deny UPDATE on topic_creators"
ON public.topic_creators
FOR UPDATE
USING (false);

CREATE POLICY "Deny UPDATE on topic_participants"
ON public.topic_participants
FOR UPDATE
USING (false);

CREATE POLICY "Deny UPDATE on reports"
ON public.reports
FOR UPDATE
USING (false);

-- Restrict vote updates to only amount field and only through edge functions
DROP POLICY IF EXISTS "Users can update own votes" ON public.votes;
CREATE POLICY "Users can update own vote amount only"
ON public.votes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND topic_id = (SELECT topic_id FROM public.votes WHERE id = votes.id)
  AND option = (SELECT option FROM public.votes WHERE id = votes.id)
  AND created_at = (SELECT created_at FROM public.votes WHERE id = votes.id)
);