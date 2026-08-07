-- Social Bot Phase 1: content generation + sandbox test posting to X / Threads / Facebook.
-- Paste into Supabase Dashboard SQL Editor (this repo has no live Supabase link).

-- 1) Post log table
CREATE TABLE IF NOT EXISTS public.social_bot_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('x', 'threads', 'facebook')),
  mode text NOT NULL CHECK (mode IN ('test', 'live')),
  content text NOT NULL,
  status text NOT NULL CHECK (status IN ('generated', 'blocked', 'posted', 'failed')),
  external_post_id text,
  error text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_bot_posts_created_at ON public.social_bot_posts (created_at DESC);

ALTER TABLE public.social_bot_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view social bot posts" ON public.social_bot_posts;
CREATE POLICY "Admins can view social bot posts"
  ON public.social_bot_posts
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Inserts only ever happen from the social-post-bot Edge Function via the service role key,
-- which bypasses RLS entirely — no INSERT policy needed for anon/authenticated roles.

-- 2) Admin-configurable settings, same key/value/category/description shape as every other
-- system_config row (see AiPromptManager.tsx / SystemConfigManager.tsx for the editor UI).
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'social_bot_platforms',
  '{"x": true, "threads": true, "facebook": true}'::jsonb,
  'social_bot',
  '社群機器人：各平台是否啟用（true/false）'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'social_bot_prompt',
  '{
    "zh": "你是 ChaosRegistry（不理性登記處）的社群小編。請用簡短、有梗、帶點荒謬幽默的語氣，寫一篇邀請大家來投票、參與話題的推廣文。不要使用過度銷售或誇大不實的字眼，不要出現真實人名、政治立場、仇恨或歧視內容。",
    "en": "You are the social media voice of ChaosRegistry, a chaotic-fun voting/community app. Write a short, witty, slightly absurd promotional post inviting people to come vote and join the chaos. No overhyped sales language, no real public figures, no hateful or discriminatory content.",
    "ja": "あなたは投票コミュニティアプリ「ChaosRegistry（不理性登記処）」のSNS担当です。短く、ユーモラスで少し荒唐無稽な語り口で、投票や話題への参加を誘う宣伝文を書いてください。誇大広告的な表現、実在の人物名、憎悪・差別的な内容は禁止です。"
  }'::jsonb,
  'social_bot',
  '社群機器人：AI 生成貼文的品牌語氣 prompt（依語言分欄，同 ai_chaos_rewrite_prompt 格式）'
)
ON CONFLICT (key) DO NOTHING;
