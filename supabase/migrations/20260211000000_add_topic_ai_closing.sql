-- Post-Topic AI Closing Statement
-- 主題結束後 AI 結語（混亂結語）

-- 1. Add ai_summary_generated to topics
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS ai_summary_generated BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.topics.ai_summary_generated IS '是否已生成 AI 混亂結語（一次性，不可重生成）';

-- 2. Create topic_ai_summary table
CREATE TABLE IF NOT EXISTS public.topic_ai_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topic_ai_summary_topic_id_key UNIQUE (topic_id)
);

COMMENT ON TABLE public.topic_ai_summary IS '主題結束後的 AI 混亂結語（娛樂性、一次性生成）';

ALTER TABLE public.topic_ai_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read topic ai summary" ON public.topic_ai_summary;

-- Everyone can read
CREATE POLICY "Everyone can read topic ai summary"
  ON public.topic_ai_summary FOR SELECT
  USING (true);

-- Only service role / edge function can insert (no explicit policy needed for service_role)
CREATE INDEX IF NOT EXISTS idx_topic_ai_summary_topic_id ON public.topic_ai_summary(topic_id);
