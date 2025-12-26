-- Add Pricing and Other Configurations

INSERT INTO public.system_config (key, value, category, description)
VALUES 
  ('exposure_costs', '{"normal": 30, "medium": 90, "high": 180}'::jsonb, 'topic_pricing', '曝光方案成本'),
  ('duration_costs', '{"1": 0, "2": 0, "3": 0, "4": 1, "5": 2, "6": 3, "7": 4, "8": 6, "9": 8, "10": 10, "11": 12, "12": 14, "13": 16, "14": 18, "15": 21, "16": 24, "17": 27, "18": 30}'::jsonb, 'topic_pricing', '投票天數成本 (天數:代幣)'),
  ('duration_max_days', '30'::jsonb, 'topic_pricing', '最大投票天數'),
  ('duration_min_days', '1'::jsonb, 'topic_pricing', '最小投票天數'),
  ('create_topic_base_cost', '0'::jsonb, 'topic_pricing', '發起主題基礎費用'),
  ('recharge_amounts', '[100, 300, 500, 1000, 3000, 5000]'::jsonb, 'wallet', '儲值金額選項'),
  ('vote_button_amounts', '[1, 5, 10, 20, 50, 100]'::jsonb, 'vote', '投票按鈕數量選項'),
  ('vote_max_amount', '1000'::jsonb, 'vote', '單次投票最大數量'),
  ('vote_min_amount', '1'::jsonb, 'vote', '單次投票最小數量'),
  ('daily_free_topic_enabled', 'false'::jsonb, 'mission', '是否啟用每日免費發起主題'),
  ('daily_free_topic_quota', '1'::jsonb, 'mission', '每日免費發起主題次數'),
  ('free_create_enabled', 'false'::jsonb, 'mission', '是否啟用免費建立資格 (任務獎勵等)'),
  ('free_create_qualification_expire_hours', '24'::jsonb, 'mission', '免費資格過期時數')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, description = EXCLUDED.description;
