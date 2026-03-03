-- 若尚未執行 20260211000000_add_topic_ai_closing.sql，先建立結語所需表與欄位，避免 RPC 報 relation 不存在。
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS ai_summary_generated BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.topic_ai_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topic_ai_summary_topic_id_key UNIQUE (topic_id)
);

ALTER TABLE public.topic_ai_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read topic ai summary" ON public.topic_ai_summary;
CREATE POLICY "Everyone can read topic ai summary"
  ON public.topic_ai_summary FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_topic_ai_summary_topic_id ON public.topic_ai_summary(topic_id);

-- RPC: 回傳「已結束且尚未有混亂結語」的主題 id 列表，供 process-ended-topics-closing 排程使用。
-- 條件：end_at <= now()、且 (ai_summary_generated = false OR ai_summary_generated IS NULL)、且 topic_ai_summary 尚無該 topic_id。
CREATE OR REPLACE FUNCTION public.get_ended_topics_without_closing()
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
  FROM public.topics t
  LEFT JOIN public.topic_ai_summary s ON s.topic_id = t.id
  WHERE t.end_at <= now()
    AND (t.ai_summary_generated = false OR t.ai_summary_generated IS NULL)
    AND s.topic_id IS NULL
  ORDER BY t.end_at ASC;
$$;

COMMENT ON FUNCTION public.get_ended_topics_without_closing() IS '排程用：取得需補 AI 混亂結語的已結束主題 id 列表';
