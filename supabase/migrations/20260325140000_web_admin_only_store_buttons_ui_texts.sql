-- Web 限制頁：商店按鈕與登出文案（與 UI_texts_error_feedback.csv 對齊）
INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES
  ('webAdminOnly.buttonAndroid', 'Google Play 下載', 'error_feedback', '網頁版限制頁：Android 商店按鈕', 'Google Play 下載', 'Get it on Google Play', 'Google Play で入手'),
  ('webAdminOnly.buttonIos', 'App Store 下載', 'error_feedback', '網頁版限制頁：iOS 商店按鈕', 'App Store 下載', 'Download on the App Store', 'App Store で入手'),
  ('webAdminOnly.signOut', '登出', 'error_feedback', '網頁版限制頁：登出按鈕', '登出', 'Sign out', 'ログアウト')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();
