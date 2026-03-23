-- 後台管理員：觀點角鬥場留言（含已回收列）可查詢、更新、刪除

DROP POLICY IF EXISTS "Admins can view all arena messages" ON public.topic_arena_messages;
CREATE POLICY "Admins can view all arena messages"
  ON public.topic_arena_messages FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update arena messages" ON public.topic_arena_messages;
CREATE POLICY "Admins can update arena messages"
  ON public.topic_arena_messages FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete arena messages" ON public.topic_arena_messages;
CREATE POLICY "Admins can delete arena messages"
  ON public.topic_arena_messages FOR DELETE
  USING (public.is_admin(auth.uid()));
