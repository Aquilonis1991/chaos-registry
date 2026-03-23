-- 更新主題字元限制：Title 80、Description 500、Option Item 50
-- 執行後可透過 system_config 覆寫；分類與後台「驗證限制」一致（validation）

INSERT INTO public.system_config (key, value, category, description)
VALUES
  ('title_max_length', '80'::jsonb, 'validation', '主題標題最大字數（80 字元）'),
  ('description_max_length', '500'::jsonb, 'validation', '主題詳述最大字數（500 字元）'),
  ('option_item_max_length', '50'::jsonb, 'validation', '單一選項最大字數（50 字元）')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = now();
