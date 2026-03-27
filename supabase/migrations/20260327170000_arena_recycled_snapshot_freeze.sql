-- Freeze recycled/time-ended arena card snapshot so it won't change after:
-- 1) user nickname edits
-- 2) ui_text canned text edits

ALTER TABLE public.topic_arena_messages
  ADD COLUMN IF NOT EXISTS recycled_body_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS recycled_approver_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS recycled_snapshot_at TIMESTAMPTZ;

COMMENT ON COLUMN public.topic_arena_messages.recycled_body_snapshot IS
  '回收/到期保留卡的一次性文案快照（固定，不再隨 ui_text 變動）';
COMMENT ON COLUMN public.topic_arena_messages.recycled_approver_name_snapshot IS
  '回收/到期保留卡核定員暱稱快照（固定，不再隨使用者改名變動）';
COMMENT ON COLUMN public.topic_arena_messages.recycled_snapshot_at IS
  '回收/到期保留卡快照寫入時間';

CREATE OR REPLACE FUNCTION public.finalize_arena_recycled_snapshots(p_message_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decay_rate INTEGER := 1;
  v_mid UUID;
  v_msg RECORD;
  v_last_upvoter_name TEXT;
  v_approver_name TEXT;
  v_variant INTEGER;
  v_body TEXT;
  v_updated_count INTEGER := 0;
BEGIN
  IF p_message_ids IS NULL OR array_length(p_message_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE((value #>> '{}')::INT, 1)
  INTO v_decay_rate
  FROM public.system_config
  WHERE key = 'arena_natural_decay_rate'
  LIMIT 1;

  FOREACH v_mid IN ARRAY p_message_ids
  LOOP
    SELECT
      m.id,
      m.upvote_count,
      m.downvote_count,
      m.ttl_minutes,
      m.shield_until,
      m.created_at,
      m.updated_at,
      m.recycled_at,
      m.recycled_body_snapshot,
      m.recycled_approver_name_snapshot
    INTO v_msg
    FROM public.topic_arena_messages m
    WHERE m.id = v_mid
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_msg.recycled_body_snapshot IS NOT NULL
       AND v_msg.recycled_approver_name_snapshot IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- 只對「已回收」或「已時間到（且非鎖定）」留言做快照
    IF NOT (
      v_msg.recycled_at IS NOT NULL
      OR (
        (v_msg.shield_until IS NULL OR v_msg.shield_until <= now())
        AND GREATEST(
          0,
          v_msg.ttl_minutes - (
            FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(v_msg.updated_at, v_msg.created_at))) / 60)::INT
            * v_decay_rate
          )
        ) <= 0
      )
    ) THEN
      CONTINUE;
    END IF;

    SELECT p.nickname
    INTO v_last_upvoter_name
    FROM public.topic_arena_votes v
    JOIN public.profiles p ON p.id = v.user_id
    WHERE v.message_id = v_msg.id
      AND v.vote_type = 'upvote'
    ORDER BY v.created_at DESC
    LIMIT 1;

    v_approver_name := COALESCE(NULLIF(BTRIM(v_last_upvoter_name), ''), '系統自動回收');

    v_variant := (ABS((('x' || SUBSTRING(md5(v_msg.id::TEXT), 1, 8))::bit(32)::INT)) % 20) + 1;

    v_body := CASE v_variant
      WHEN 1 THEN format('留言壽命已結束並完成回收。最終結果：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 2 THEN format('本則留言已到期回收。結算：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 3 THEN format('存在週期歸零，系統已回收留言。最終票數：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 4 THEN format('留言已從角鬥場退場。成績：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 5 THEN format('本次觀點已完成週期並回收。最終：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 6 THEN format('留言已到期下架。最終統計：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 7 THEN format('系統已回收此留言。最後結果：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 8 THEN format('時間到，留言已回收。最終比分：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 9 THEN format('觀點存續期已結束。最終回合：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 10 THEN format('這則留言已被回收封存。最終票況：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 11 THEN format('留言週期結束，系統已清場。成績：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 12 THEN format('此留言已完成使命並回收。最終：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 13 THEN format('留言已進入回收狀態。最終互動：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 14 THEN format('本則內容已結束展示並回收。結果：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 15 THEN format('留言已從場上退役。最終數據：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 16 THEN format('觀點時效結束，系統完成回收。最終：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 17 THEN format('留言已落幕回收。最終統計：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 18 THEN format('這則發言已完成回合並回收。最終結果：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      WHEN 19 THEN format('留言存在值耗盡，系統已回收。最終：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
      ELSE format('留言已回收完畢。最終票數：👍贊同 %s / 👎斥責 %s。', v_msg.upvote_count, v_msg.downvote_count)
    END;

    UPDATE public.topic_arena_messages
    SET
      recycled_body_snapshot = COALESCE(recycled_body_snapshot, v_body),
      recycled_approver_name_snapshot = COALESCE(recycled_approver_name_snapshot, v_approver_name),
      recycled_snapshot_at = COALESCE(recycled_snapshot_at, now()),
      updated_at = now()
    WHERE id = v_msg.id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_arena_recycled_snapshots(UUID[]) TO authenticated;
NOTIFY pgrst, 'reload schema';
