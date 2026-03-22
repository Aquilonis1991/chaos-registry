-- 觀點角鬥場 V30.0：system_config + 資料表
-- Phase 1: 配置與表結構

-- 1) system_config：arena 參數
INSERT INTO public.system_config (key, value, category, description)
VALUES
  ('arena_elite_min_threshold_y', '50', 'arena', '進駐精英區最低淨贊同'),
  ('arena_throne_min_threshold_x', '100', 'arena', '登基核心區淨贊同門檻'),
  ('arena_mundane_access_votes', '5', 'arena', '該話題投票達此數才可發表觀點'),
  ('arena_base_data_ttl', '180', 'arena', '初始 TTL（分鐘）'),
  ('arena_natural_decay_rate', '1', 'arena', '每分鐘 TTL 消耗'),
  ('arena_upvote_time_bonus', '10', 'arena', '贊同 +TTL（分鐘）'),
  ('arena_downvote_time_penalty', '12', 'arena', '斥責 -TTL（分鐘）'),
  ('arena_comment_max_length', '100', 'arena', '字數上限'),
  ('arena_shield_price', '100', 'arena', '鎖定保險價格（代幣）'),
  ('arena_shield_duration_hours', '3', 'arena', '鎖定時長（小時）'),
  ('arena_shield_legacy_bonus', '180', 'arena', '購買保險額外 TTL（分鐘）')
ON CONFLICT (key) DO NOTHING;

-- 2) topic_arena_messages
CREATE TABLE IF NOT EXISTS public.topic_arena_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  ttl_minutes INTEGER NOT NULL,
  shield_until TIMESTAMPTZ,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  downvote_count INTEGER NOT NULL DEFAULT 0,
  is_legacy BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topic_arena_messages_one_per_user UNIQUE (topic_id, user_id),
  CONSTRAINT topic_arena_messages_content_len CHECK (char_length(content) <= 100)
);

COMMENT ON TABLE public.topic_arena_messages IS '觀點角鬥場留言（每人每話題限一則）';
CREATE INDEX IF NOT EXISTS idx_arena_messages_topic ON public.topic_arena_messages(topic_id);
CREATE INDEX IF NOT EXISTS idx_arena_messages_user ON public.topic_arena_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_arena_messages_ttl ON public.topic_arena_messages(ttl_minutes) WHERE ttl_minutes > 0;

ALTER TABLE public.topic_arena_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Arena messages readable by all" ON public.topic_arena_messages;
CREATE POLICY "Arena messages readable by all" ON public.topic_arena_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can insert arena messages" ON public.topic_arena_messages;
CREATE POLICY "Authenticated can insert arena messages" ON public.topic_arena_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3) topic_arena_votes
CREATE TABLE IF NOT EXISTS public.topic_arena_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.topic_arena_messages(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topic_arena_votes_unique UNIQUE (user_id, message_id)
);

COMMENT ON TABLE public.topic_arena_votes IS '觀點角鬥場贊同/斥責（每人每則限一次）';
CREATE INDEX IF NOT EXISTS idx_arena_votes_message ON public.topic_arena_votes(message_id);
CREATE INDEX IF NOT EXISTS idx_arena_votes_user ON public.topic_arena_votes(user_id);

ALTER TABLE public.topic_arena_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Arena votes readable by all" ON public.topic_arena_votes;
CREATE POLICY "Arena votes readable by all" ON public.topic_arena_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can insert arena votes" ON public.topic_arena_votes;
CREATE POLICY "Authenticated can insert arena votes" ON public.topic_arena_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
