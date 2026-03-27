-- Backfill recycled approver snapshot from the latest downvoter.
-- Purpose:
-- 1) Fix historical rows snapshotted as "系統自動回收" by old logic
-- 2) Keep snapshot immutable afterward unless currently fallback/system value

WITH latest_downvoter AS (
  SELECT DISTINCT ON (v.message_id)
    v.message_id,
    COALESCE(NULLIF(BTRIM(p.nickname), ''), '系統自動回收') AS nickname
  FROM public.topic_arena_votes v
  JOIN public.profiles p ON p.id = v.user_id
  WHERE v.vote_type = 'downvote'
  ORDER BY v.message_id, v.created_at DESC
)
UPDATE public.topic_arena_messages m
SET
  recycled_approver_name_snapshot = ld.nickname,
  recycled_snapshot_at = COALESCE(m.recycled_snapshot_at, now()),
  updated_at = now()
FROM latest_downvoter ld
WHERE m.id = ld.message_id
  AND (
    m.recycled_at IS NOT NULL
    OR m.ttl_minutes <= 0
  )
  AND (
    m.recycled_approver_name_snapshot IS NULL
    OR BTRIM(m.recycled_approver_name_snapshot) = ''
    OR m.recycled_approver_name_snapshot = '系統自動回收'
  );

NOTIFY pgrst, 'reload schema';
