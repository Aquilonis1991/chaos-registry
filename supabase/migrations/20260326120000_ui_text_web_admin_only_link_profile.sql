INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES (
  'webAdminOnly.linkProfile',
  '前往個人頁面',
  'error_feedback',
  '網頁版限制頁：進入個人頁連結',
  '前往個人頁面',
  'Go to profile',
  'プロフィールへ'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();
