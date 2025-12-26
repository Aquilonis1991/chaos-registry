-- Add Topic Constraint Configurations

INSERT INTO public.system_config (key, value, category, description)
VALUES 
  ('title_max_length', '200'::jsonb, 'topic_limits', '主題標題最大字數限制'),
  ('title_min_length', '5'::jsonb, 'topic_limits', '主題標題最小字數限制'),
  ('description_max_length', '150'::jsonb, 'topic_limits', '主題詳述最大字數限制'),
  ('option_max_count', '6'::jsonb, 'topic_limits', '投票選項最大數量'),
  ('option_min_count', '2'::jsonb, 'topic_limits', '投票選項最小數量'),
  ('tags_max_count', '5'::jsonb, 'topic_limits', '主題標籤最大數量')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, description = EXCLUDED.description;
