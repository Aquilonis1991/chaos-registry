-- Create system_config table for storing all system configuration values
CREATE TABLE public.system_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  category text NOT NULL,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view and modify system config
CREATE POLICY "Only admins can view system config"
ON public.system_config
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can update system config"
ON public.system_config
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can insert system config"
ON public.system_config
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_system_config_updated_at
BEFORE UPDATE ON public.system_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Insert default configuration values
INSERT INTO public.system_config (key, value, category, description) VALUES
  -- 儲值配置
  ('recharge_amounts', '{"1": 100, "5": 550, "10": 1200, "20": 2600}', 'recharge', '儲值金額對應的代幣數量（美金:代幣）'),
  
  -- 字數限制
  ('title_max_length', '200', 'validation', '主題標題最大字數'),
  ('title_min_length', '5', 'validation', '主題標題最小字數'),
  ('description_max_length', '150', 'validation', '主題描述最大字數'),
  
  -- 選項限制
  ('option_min_count', '2', 'validation', '最少選項數量'),
  ('option_max_count', '6', 'validation', '最多選項數量'),
  ('tags_max_count', '5', 'validation', '最多標籤數量'),
  
  -- 投票按鈕數量
  ('vote_button_amounts', '[1, 5, 10, 20, 50, 100]', 'voting', '投票按鈕可選擇的數量'),
  ('vote_max_amount', '100', 'voting', '單次投票最大數量'),
  ('vote_min_amount', '1', 'voting', '單次投票最小數量'),
  
  -- 曝光方案成本
  ('exposure_costs', '{"normal": 30, "medium": 90, "high": 180}', 'topic_cost', '曝光方案的代幣成本'),
  
  -- 投票天數成本
  ('duration_costs', '{"1": 0, "2": 0, "3": 0, "4": 1, "5": 2, "6": 3, "7": 4, "8": 6, "9": 8, "10": 10, "11": 12, "12": 14, "13": 16, "14": 18, "15": 21, "16": 24, "17": 27, "18": 30}', 'topic_cost', '投票天數對應的額外代幣成本'),
  ('duration_min_days', '1', 'topic_cost', '投票最少天數'),
  ('duration_max_days', '30', 'topic_cost', '投票最多天數'),
  
  -- 任務獎勵
  ('mission_watch_ad_reward', '10', 'mission', '觀看廣告任務獎勵'),
  ('mission_watch_ad_limit', '5', 'mission', '每日觀看廣告次數上限'),
  ('mission_create_topic_reward', '5', 'mission', '發起主題任務獎勵'),
  ('mission_vote_reward', '2', 'mission', '參與投票任務獎勵'),
  
  -- 新用戶初始代幣
  ('new_user_tokens', '50', 'user', '新用戶註冊獲得的初始代幣數量');