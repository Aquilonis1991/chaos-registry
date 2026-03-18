-- 隱私權政策日文／英文內容，供 /privacy/jp、/privacy/en 頁面與後台條款管理使用
INSERT INTO public.system_config (key, value, category, description)
VALUES
  ('legal_privacy_content_jp', '""', 'legal', '隱私權政策內容（日文），顯示於 /privacy/jp'),
  ('legal_privacy_content_en', '""', 'legal', '隱私權政策內容（英文），顯示於 /privacy/en')
ON CONFLICT (key) DO NOTHING;
