-- Add configuration for topic banned word check levels
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'topic_banned_check_levels',
  '["A","B","C","D","E"]',
  'validation',
  '建立主題與標籤時需要拒絕的禁字級別（JSON 陣列）'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

