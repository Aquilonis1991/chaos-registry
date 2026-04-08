-- Allow admins to manage topics in backend (hide/unhide/delete/update).

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

