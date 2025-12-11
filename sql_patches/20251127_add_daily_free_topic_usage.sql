-- 建立每日免費發起主題使用紀錄與相關函數

CREATE TABLE IF NOT EXISTS public.daily_free_topic_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  topic_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.daily_free_topic_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily free usage" ON public.daily_free_topic_usage;
CREATE POLICY "Users can view own daily free usage"
  ON public.daily_free_topic_usage
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily free usage" ON public.daily_free_topic_usage;
CREATE POLICY "Users can insert own daily free usage"
  ON public.daily_free_topic_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily free usage" ON public.daily_free_topic_usage;
CREATE POLICY "Users can update own daily free usage"
  ON public.daily_free_topic_usage
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 檢查今日是否可使用每日免費額度
DROP FUNCTION IF EXISTS public.can_use_daily_free_topic(UUID);
CREATE OR REPLACE FUNCTION public.can_use_daily_free_topic(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.daily_free_topic_usage
    WHERE user_id = check_user_id
      AND usage_date = CURRENT_DATE
  );
END;
$$;

-- 標記已使用每日免費額度
DROP FUNCTION IF EXISTS public.mark_daily_free_topic_used(UUID, UUID);
CREATE OR REPLACE FUNCTION public.mark_daily_free_topic_used(
  p_user_id UUID,
  p_topic_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.daily_free_topic_usage (user_id, usage_date, topic_id)
  VALUES (p_user_id, CURRENT_DATE, p_topic_id)
  ON CONFLICT (user_id, usage_date) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_use_daily_free_topic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_daily_free_topic_used(UUID, UUID) TO authenticated;

-- 若尚未設定，新增每日免費相關系統設定
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('daily_free_topic_enabled', 'true', 'topic_cost', '是否啟用每日首篇免費發起主題'),
  ('daily_free_topic_quota', '1', 'topic_cost', '每日免費發起主題的次數限制')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';



