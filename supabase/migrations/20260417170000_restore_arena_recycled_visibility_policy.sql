-- topic_arena_messages 的 SELECT policy 現在是 qual=true（所有人可讀所有列，
-- 包含已回收/歸零下架的留言）。這跟 20260321120000_arena_soft_recycle_ttl.sql
-- 當初設計的「已回收留言只有作者自己看得到」不一致——不確定是那個 migration
-- 從未真的套用到正式環境，還是後來被其他 migration 覆蓋掉，總之現況跟預期
-- 設計不符，重新套用回正確版本。

DROP POLICY IF EXISTS "Arena messages readable by all" ON public.topic_arena_messages;
CREATE POLICY "Arena messages readable by all"
  ON public.topic_arena_messages FOR SELECT
  USING (recycled_at IS NULL OR user_id = auth.uid());

-- 確認結果
select policyname, qual
from pg_policies
where schemaname = 'public' and tablename = 'topic_arena_messages' and cmd = 'SELECT';
