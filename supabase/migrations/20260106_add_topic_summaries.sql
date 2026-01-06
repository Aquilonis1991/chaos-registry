-- Create topic_summaries table
CREATE TABLE IF NOT EXISTS public.topic_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  summary_zh text,
  summary_en text,
  summary_ja text,
  chaos_level text NOT NULL DEFAULT 'IV',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT topic_summaries_topic_id_key UNIQUE (topic_id)
);

-- Enable RLS
ALTER TABLE public.topic_summaries ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read summaries
CREATE POLICY "Everyone can read topic summaries"
  ON public.topic_summaries FOR SELECT
  USING (true);

-- Service role only can insert/update (handled by Edge Function service key)
-- No explicit policy needed for service role as it bypasses RLS, but for clarity/admin:
CREATE POLICY "Admins can delete topic summaries"
  ON public.topic_summaries FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Index
CREATE INDEX IF NOT EXISTS idx_topic_summaries_topic_id ON public.topic_summaries(topic_id);
