-- ========================================
-- 建立主題標籤規範化與會員偏好統計
-- ========================================

-- 需要 unaccent extension 來做基礎標籤正規化
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1) 標籤正規化函數
CREATE OR REPLACE FUNCTION public.normalize_topic_tag(p_tag TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
SELECT NULLIF(
  regexp_replace(
    regexp_replace(lower(unaccent(trim(COALESCE(p_tag, '')))), '\s+', '-', 'g'),
    '-{2,}', '-', 'g'
  ),
  ''
);
$$;

-- 2) 儲存標準化結果
CREATE TABLE IF NOT EXISTS public.topic_tag_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  raw_tag TEXT NOT NULL,
  normalized_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.topic_tag_entries ENABLE ROW LEVEL SECURITY;

-- 所有使用者都可以查看公開主題的標籤資料
DROP POLICY IF EXISTS "Allow tag entries select" ON public.topic_tag_entries;
CREATE POLICY "Allow tag entries select"
  ON public.topic_tag_entries
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_topic_tag_entries_topic ON public.topic_tag_entries(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_tag_entries_normalized_tag ON public.topic_tag_entries(normalized_tag);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_topic_tag_entries_topic_tag ON public.topic_tag_entries(topic_id, normalized_tag);

-- 更新 updated_at
DROP TRIGGER IF EXISTS update_topic_tag_entries_updated_at ON public.topic_tag_entries;
CREATE TRIGGER update_topic_tag_entries_updated_at
  BEFORE UPDATE ON public.topic_tag_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3) 觸發函數：同步 topics.tags -> topic_tag_entries
CREATE OR REPLACE FUNCTION public.sync_topic_tag_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.topic_tag_entries WHERE topic_id = NEW.id;

  IF NEW.tags IS NULL OR array_length(NEW.tags, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.topic_tag_entries (topic_id, raw_tag, normalized_tag)
  SELECT NEW.id, tag, normalized_tag
  FROM (
    SELECT tag, public.normalize_topic_tag(tag) AS normalized_tag
    FROM unnest(NEW.tags) AS tag
  ) t
  WHERE t.normalized_tag IS NOT NULL
  ON CONFLICT (topic_id, normalized_tag) DO UPDATE
    SET raw_tag = EXCLUDED.raw_tag,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_topic_tag_entries_insert ON public.topics;
CREATE TRIGGER sync_topic_tag_entries_insert
  AFTER INSERT ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.sync_topic_tag_entries();

DROP TRIGGER IF EXISTS sync_topic_tag_entries_update ON public.topics;
CREATE TRIGGER sync_topic_tag_entries_update
  AFTER UPDATE OF tags ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.sync_topic_tag_entries();

-- 4) 儲存會員偏好結果
CREATE TABLE IF NOT EXISTS public.user_tag_preferences (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  normalized_tag TEXT NOT NULL,
  display_tag TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  token_amount INTEGER NOT NULL DEFAULT 0,
  last_voted_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, normalized_tag)
);

ALTER TABLE public.user_tag_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tag prefs" ON public.user_tag_preferences;
CREATE POLICY "Users can view own tag prefs"
  ON public.user_tag_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 5) 根據會員重算偏好的函數
CREATE OR REPLACE FUNCTION public.refresh_user_tag_preferences(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  WITH tag_stats AS (
    SELECT
      v.user_id,
      tte.normalized_tag,
      MIN(tte.raw_tag) AS display_tag,
      COUNT(*)::INT AS vote_count,
      COALESCE(SUM(GREATEST(v.amount, 0)), 0)::INT AS token_amount,
      MAX(v.created_at) AS last_voted_at
    FROM public.votes v
    JOIN public.topic_tag_entries tte ON tte.topic_id = v.topic_id
    WHERE v.user_id = p_user_id
    GROUP BY v.user_id, tte.normalized_tag
  ),
  upserted AS (
    INSERT INTO public.user_tag_preferences (user_id, normalized_tag, display_tag, vote_count, token_amount, last_voted_at)
    SELECT user_id, normalized_tag, display_tag, vote_count, token_amount, last_voted_at
    FROM tag_stats
    ON CONFLICT (user_id, normalized_tag) DO UPDATE
      SET display_tag = EXCLUDED.display_tag,
          vote_count = EXCLUDED.vote_count,
          token_amount = EXCLUDED.token_amount,
          last_voted_at = EXCLUDED.last_voted_at
    RETURNING normalized_tag
  )
  DELETE FROM public.user_tag_preferences
  WHERE user_id = p_user_id
    AND normalized_tag NOT IN (SELECT normalized_tag FROM upserted);

  -- 如果沒有任何統計結果，清除舊資料
  IF NOT EXISTS (SELECT 1 FROM tag_stats) THEN
    DELETE FROM public.user_tag_preferences WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- 6) 針對某個主題的所有投票人重算
CREATE OR REPLACE FUNCTION public.refresh_user_tag_preferences_for_topic(p_topic_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT user_id
    FROM public.votes
    WHERE topic_id = p_topic_id
  LOOP
    PERFORM public.refresh_user_tag_preferences(rec.user_id);
  END LOOP;
END;
$$;

-- 7) 觸發函數：投票異動時刷新
CREATE OR REPLACE FUNCTION public.trigger_refresh_user_tag_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_user UUID;
BEGIN
  target_user := COALESCE(NEW.user_id, OLD.user_id);
  PERFORM public.refresh_user_tag_preferences(target_user);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS refresh_user_tag_preferences_on_votes ON public.votes;
CREATE TRIGGER refresh_user_tag_preferences_on_votes
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_refresh_user_tag_preferences();

-- 8) 當主題標籤改變時刷新所有該主題的投票人偏好
CREATE OR REPLACE FUNCTION public.trigger_refresh_user_tag_preferences_on_topics()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_user_tag_preferences_for_topic(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_user_tag_preferences_on_topics ON public.topics;
CREATE TRIGGER refresh_user_tag_preferences_on_topics
  AFTER UPDATE OF tags ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.trigger_refresh_user_tag_preferences_on_topics();

-- 9) 供前端/後台查詢的 RPC
CREATE OR REPLACE FUNCTION public.get_user_tag_preferences(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  normalized_tag TEXT,
  display_tag TEXT,
  vote_count INTEGER,
  token_amount INTEGER,
  last_voted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user UUID;
BEGIN
  target_user := COALESCE(p_user_id, auth.uid());

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF target_user <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
    SELECT normalized_tag, display_tag, vote_count, token_amount, last_voted_at
    FROM public.user_tag_preferences
    WHERE user_id = target_user
    ORDER BY vote_count DESC, token_amount DESC, last_voted_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tag_preferences(UUID) TO authenticated;

-- 10) 既有資料回填
INSERT INTO public.topic_tag_entries (topic_id, raw_tag, normalized_tag)
SELECT t.id, tag, public.normalize_topic_tag(tag)
FROM public.topics t
CROSS JOIN LATERAL unnest(t.tags) AS tag
WHERE public.normalize_topic_tag(tag) IS NOT NULL
ON CONFLICT (topic_id, normalized_tag) DO UPDATE
  SET raw_tag = EXCLUDED.raw_tag,
      updated_at = now();

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT DISTINCT user_id FROM public.votes LOOP
    PERFORM public.refresh_user_tag_preferences(rec.user_id);
  END LOOP;
END;
$$;


