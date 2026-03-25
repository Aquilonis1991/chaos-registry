-- UI texts: auth forgot password link text
INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES
  (
    'auth_forgot_password_link',
    '忘記密碼？',
    'auth',
    '登入頁：忘記密碼連結文字',
    '忘記密碼？',
    'Forgot password?',
    'パスワードをお忘れですか？'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();

