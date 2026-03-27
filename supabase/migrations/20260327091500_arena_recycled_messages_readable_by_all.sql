-- Arena: recycled messages should be readable by everyone.
-- Previous policy limited recycled rows to the original author only.
-- Frontend now renders recycled rows as replacement cards for all users.

DROP POLICY IF EXISTS "Arena messages readable by all" ON public.topic_arena_messages;

CREATE POLICY "Arena messages readable by all"
  ON public.topic_arena_messages
  FOR SELECT
  USING (true);

NOTIFY pgrst, 'reload schema';
