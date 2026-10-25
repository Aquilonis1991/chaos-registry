-- 免登入匿名投票：一裝置一票，個別紀錄不公開，只開放彙總。

CREATE TABLE IF NOT EXISTS public.anon_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  option_id text NOT NULL,
  device_id uuid NOT NULL,
  fingerprint_hash text NOT NULL,
  ip_hash text,
  src text NOT NULL DEFAULT 'direct',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS anon_votes_topic_device_uidx
  ON public.anon_votes (topic_id, device_id);

CREATE UNIQUE INDEX IF NOT EXISTS anon_votes_topic_fingerprint_uidx
  ON public.anon_votes (topic_id, fingerprint_hash);

CREATE INDEX IF NOT EXISTS anon_votes_topic_ip_recent_idx
  ON public.anon_votes (topic_id, ip_hash, created_at);

ALTER TABLE public.anon_votes ENABLE ROW LEVEL SECURITY;

-- 沒有任何 anon/authenticated policy：前端不能讀寫個別紀錄。
-- service role 繞過 RLS，只給 Edge Function 寫入。

CREATE TABLE IF NOT EXISTS public.topic_threads_posts (
  topic_id uuid PRIMARY KEY REFERENCES public.topics(id) ON DELETE CASCADE,
  threads_media_id text NOT NULL,
  replied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_threads_posts ENABLE ROW LEVEL SECURITY;

INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'anon_vote_ip_cap_24h',
  '5'::jsonb,
  'vote',
  '同一個 IP 雜湊、同一個主題，24 小時內最多幾張匿名票'
)
ON CONFLICT (key) DO NOTHING;

-- bot：bot_profiles，或 adminN@votechaos.app 這批 AI 演員帳號。
CREATE OR REPLACE FUNCTION public.is_vote_bot(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_bot boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF to_regclass('public.bot_profiles') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.bot_profiles WHERE user_id = $1)'
      INTO v_bot
      USING p_user_id;
    IF v_bot THEN
      RETURN true;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p_user_id
      AND u.email LIKE 'admin%@votechaos.app'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_vote_bot(uuid) FROM PUBLIC, anon, authenticated;

-- 公開彙總：匿名票（一人一票）與會員加碼（代幣加權，不含 bot）。
CREATE OR REPLACE FUNCTION public.get_topic_vote_breakdown(p_topic_id uuid)
RETURNS TABLE (
  option_id text,
  anon_votes integer,
  member_votes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH opts AS (
    SELECT COALESCE(e.value->>'id', 'option-' || (e.ordinality - 1)::text) AS option_id
    FROM public.topics t
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.options, '[]'::jsonb)) WITH ORDINALITY AS e(value, ordinality)
    WHERE t.id = p_topic_id
  ),
  anon AS (
    SELECT a.option_id, COUNT(*)::integer AS n
    FROM public.anon_votes a
    WHERE a.topic_id = p_topic_id
    GROUP BY a.option_id
  ),
  member_token AS (
    SELECT v.option AS option_id, COALESCE(SUM(v.amount), 0)::integer AS n
    FROM public.votes v
    WHERE v.topic_id = p_topic_id
      AND NOT public.is_vote_bot(v.user_id)
    GROUP BY v.option
  ),
  member_free AS (
    SELECT f.option AS option_id, COUNT(*)::integer AS n
    FROM public.free_votes f
    WHERE f.topic_id = p_topic_id
      AND NOT public.is_vote_bot(f.user_id)
    GROUP BY f.option
  )
  SELECT
    o.option_id,
    COALESCE(a.n, 0) AS anon_votes,
    COALESCE(mt.n, 0) + COALESCE(mf.n, 0) AS member_votes
  FROM opts o
  LEFT JOIN anon a ON a.option_id = o.option_id
  LEFT JOIN member_token mt ON mt.option_id = o.option_id
  LEFT JOIN member_free mf ON mf.option_id = o.option_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_topic_vote_breakdown(uuid) TO anon, authenticated;

-- 後台：每個主題各來源的匿名票數。個別投票者不公開。
CREATE OR REPLACE FUNCTION public.get_anon_vote_source_stats()
RETURNS TABLE (
  topic_id uuid,
  title text,
  src text,
  anon_votes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not admin';
  END IF;

  RETURN QUERY
  SELECT a.topic_id, t.title, a.src, COUNT(*)::bigint
  FROM public.anon_votes a
  JOIN public.topics t ON t.id = a.topic_id
  GROUP BY a.topic_id, t.title, a.src
  ORDER BY COUNT(*) DESC, t.title, a.src;
END;
$$;

REVOKE ALL ON FUNCTION public.get_anon_vote_source_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_anon_vote_source_stats() TO authenticated;

-- IP 雜湊 30 天後清掉，投票本身保留。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'anon-vote-ip-hash-purge') THEN
    PERFORM cron.unschedule('anon-vote-ip-hash-purge');
  END IF;
  PERFORM cron.schedule(
    'anon-vote-ip-hash-purge',
    '15 3 * * *',
    $job$
      UPDATE public.anon_votes
      SET ip_hash = NULL
      WHERE ip_hash IS NOT NULL
        AND created_at < now() - interval '30 days';
    $job$
  );
EXCEPTION
  WHEN undefined_function OR invalid_schema_name THEN
    RAISE NOTICE 'pg_cron unavailable, skip anon-vote-ip-hash-purge';
END $$;
