-- 觀點角鬥場：decay_arena_ttl 改用「距離該列自己上次 updated_at 實際經過的分鐘數」
-- 來計算扣減量，取代原本直接吃呼叫端傳入 p_minutes（前端固定傳 10 或 30）的做法。
--
-- 根因：投票（cast_arena_vote）成功後，前端會立刻做一次靜默刷新
-- （src/hooks/useArenaBoard.ts 的 vote()），而 fetchArenaBoard 在抓留言前一定先呼叫
-- decay_arena_ttl(10)（src/lib/arena/arenaApi.ts）。舊版 decay_arena_ttl 不管實際經過
-- 多少真實時間，一律扣「10 分鐘 × 衰減率」，於是投票當下（真實經過時間趨近於 0）
-- 也會被扣掉一次固定量的衰減，幾乎把贊同的 +10 分鐘加成完全抵銷，也讓斥責的 -12
-- 分鐘懲罰被放大成 -22。改成用真實經過時間計算後，這個「投票後立刻被同一動作
-- 觸發的衰減吃掉」的問題會直接消失：投票剛發生時 now()-updated_at 趨近 0，
-- 該次呼叫對這則留言的衰減自然也趨近 0，不需要另外在前端调整靜默刷新的時序。
--
-- 附帶效果：p_minutes 這個呼叫端可控參數不再影響實際扣減量（之前任何登入使用者
-- 都能直接呼叫 RPC 傳大數值，雖有 LEAST(...,60) 上限，但仍是可被前端呼叫端操控的
-- 輸入），現在扣減量完全由伺服器端 now()-updated_at 決定，不受呼叫端輸入影響。
-- 參數簽章維持不變（避免破壞既有呼叫端與零參數 overload），僅內部不再使用其數值。

CREATE OR REPLACE FUNCTION public.decay_arena_ttl(p_minutes INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decay_rate INTEGER := 1;
  v_updated INTEGER := 0;
  v_recycled INTEGER := 0;
  v_has_recycled_at BOOLEAN := false;
BEGIN
  SELECT COALESCE((value #>> '{}')::INT, 1)
  INTO v_decay_rate
  FROM public.system_config
  WHERE key = 'arena_natural_decay_rate'
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'topic_arena_messages'
      AND column_name = 'recycled_at'
  )
  INTO v_has_recycled_at;

  -- 每列各自依「now() - updated_at」換算實際經過分鐘數 × 衰減率，
  -- 不再套用呼叫端傳入的固定 p_minutes。
  WITH active_topics AS (
    SELECT id
    FROM public.topics
    WHERE status != 'ended' AND end_at > now()
  ),
  decayed AS (
    UPDATE public.topic_arena_messages m
    SET ttl_minutes = GREATEST(
          0,
          m.ttl_minutes - (
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - m.updated_at)) / 60))::INTEGER * v_decay_rate
          )
        ),
        updated_at = now()
    FROM active_topics t
    WHERE m.topic_id = t.id
      AND m.is_legacy = false
      AND (m.shield_until IS NULL OR m.shield_until <= now())
      AND (NOT v_has_recycled_at OR m.recycled_at IS NULL)
    RETURNING m.id
  )
  SELECT COUNT(*) INTO v_updated FROM decayed;

  IF v_has_recycled_at THEN
    WITH active_topics AS (
      SELECT id
      FROM public.topics
      WHERE status != 'ended' AND end_at > now()
    ),
    recycled AS (
      UPDATE public.topic_arena_messages m
      SET recycled_at = now(),
          ttl_minutes = 0,
          updated_at = now()
      FROM active_topics t
      WHERE m.topic_id = t.id
        AND m.is_legacy = false
        AND m.recycled_at IS NULL
        AND m.ttl_minutes <= 0
        AND (m.shield_until IS NULL OR m.shield_until <= now())
      RETURNING m.id
    )
    SELECT COUNT(*) INTO v_recycled FROM recycled;
  ELSE
    WITH active_topics AS (
      SELECT id
      FROM public.topics
      WHERE status != 'ended' AND end_at > now()
    ),
    removed AS (
      DELETE FROM public.topic_arena_messages m
      USING active_topics t
      WHERE m.topic_id = t.id
        AND m.is_legacy = false
        AND m.ttl_minutes <= 0
        AND (m.shield_until IS NULL OR m.shield_until <= now())
      RETURNING m.id
    )
    SELECT COUNT(*) INTO v_recycled FROM removed;
  END IF;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'recycled', v_recycled,
    'mode', CASE WHEN v_has_recycled_at THEN 'soft_recycle' ELSE 'delete' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decay_arena_ttl(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decay_arena_ttl(INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
