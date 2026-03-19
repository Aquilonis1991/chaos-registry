-- 參與者付費影響主題（MVP）
-- 1) topics：兩個開關 + 延長次數
-- 2) system_config：成本與上限（可即時調整）
-- 3) logs：延長紀錄 / 新增選項紀錄

-- 1) topics 欄位
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS allow_time_extension BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_option_addition BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extension_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_extension_count INTEGER NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.topics.allow_time_extension IS '是否允許參與者付費延長投票時間';
COMMENT ON COLUMN public.topics.allow_option_addition IS '是否允許參與者付費新增投票選項';
COMMENT ON COLUMN public.topics.extension_count IS '已延長次數（參與者付費延長）';
COMMENT ON COLUMN public.topics.max_extension_count IS '最多可延長次數（預設 3）';

-- 2) system_config：成本 key（不可寫死）
INSERT INTO public.system_config (key, value, category, description)
VALUES
  ('extend_topic_1_day_cost', '30', 'topic_cost', '參與者延長投票 +1 天的代幣成本'),
  ('extend_topic_2_day_cost', '50', 'topic_cost', '參與者延長投票 +2 天的代幣成本'),
  ('extend_topic_3_day_cost', '70', 'topic_cost', '參與者延長投票 +3 天的代幣成本'),
  ('add_topic_option_cost', '40', 'topic_cost', '參與者新增投票選項的代幣成本'),
  ('topic_time_extension_max_per_topic', '3', 'topic_cost', '每主題最多延長次數（預設 3）'),
  ('topic_time_extension_max_days_per_action', '3', 'topic_cost', '每次延長最多天數（預設 3）'),
  ('topic_time_extension_only_when_remaining_hours_leq', '48', 'topic_cost', '僅剩餘時間 <= N 小時可延長（預設 48）'),
  ('topic_time_extension_max_per_user', '1', 'topic_cost', '每位使用者每主題最多延長次數（預設 1）'),
  ('topic_option_add_max_per_topic', '5', 'topic_cost', '每主題最多可新增選項數（預設 5）'),
  ('topic_option_add_max_per_user', '1', 'topic_cost', '每位使用者每主題最多新增選項數（預設 1）'),
  ('topic_option_add_min_length', '2', 'topic_cost', '新增選項最少字元（預設 2）'),
  ('topic_option_add_max_length', '20', 'topic_cost', '新增選項最多字元（預設 20）')
ON CONFLICT (key) DO NOTHING;

-- 3) logs tables
CREATE TABLE IF NOT EXISTS public.topic_extension_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  days_added INTEGER NOT NULL CHECK (days_added IN (1, 2, 3)),
  token_cost INTEGER NOT NULL CHECK (token_cost > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topic_extension_logs_unique_user_topic UNIQUE (topic_id, user_id)
);

COMMENT ON TABLE public.topic_extension_logs IS '參與者付費延長投票時間紀錄（每用戶每主題最多 1 筆）';

ALTER TABLE public.topic_extension_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read topic extension logs" ON public.topic_extension_logs;
CREATE POLICY "Everyone can read topic extension logs"
  ON public.topic_extension_logs FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_topic_extension_logs_topic_id ON public.topic_extension_logs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_extension_logs_user_id ON public.topic_extension_logs(user_id);

CREATE TABLE IF NOT EXISTS public.topic_option_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  token_cost INTEGER NOT NULL CHECK (token_cost > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.topic_option_logs IS '參與者付費新增投票選項紀錄';

ALTER TABLE public.topic_option_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can read topic option logs" ON public.topic_option_logs;
CREATE POLICY "Everyone can read topic option logs"
  ON public.topic_option_logs FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_topic_option_logs_topic_id ON public.topic_option_logs(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_option_logs_user_id ON public.topic_option_logs(user_id);

-- 刷新 Schema Cache（PostgREST）
NOTIFY pgrst, 'reload schema';

