-- Fix admin topic hide/delete failures:
-- 1) Ensure topic moderation columns exist.
-- 2) Ensure admin RLS policies allow SELECT/UPDATE/DELETE on topics.

ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hidden_reason text,
  ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_topics_is_hidden ON public.topics(is_hidden);
CREATE INDEX IF NOT EXISTS idx_topics_report_count ON public.topics(report_count);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all topics" ON public.topics;
CREATE POLICY "Admins can view all topics"
ON public.topics
FOR SELECT
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all topics" ON public.topics;
CREATE POLICY "Admins can update all topics"
ON public.topics
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete all topics" ON public.topics;
CREATE POLICY "Admins can delete all topics"
ON public.topics
FOR DELETE
USING (public.is_admin(auth.uid()));

NOTIFY pgrst, 'reload schema';

