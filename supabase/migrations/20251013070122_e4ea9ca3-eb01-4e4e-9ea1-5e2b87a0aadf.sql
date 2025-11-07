-- Add language columns to ui_texts table
ALTER TABLE public.ui_texts 
ADD COLUMN zh TEXT,
ADD COLUMN en TEXT,
ADD COLUMN ja TEXT;

-- Update existing records to have language-specific values (set zh as current value)
UPDATE public.ui_texts SET zh = value WHERE zh IS NULL;

-- Insert auth page UI texts
INSERT INTO public.ui_texts (key, value, zh, en, ja, category, description) VALUES
-- Header texts
('auth.title', 'VoteChaos', 'VoteChaos', 'VoteChaos', 'VoteChaos', 'auth', 'App title on auth page'),
('auth.subtitle', '加入最有趣的投票社群', '加入最有趣的投票社群', 'Join the most interesting voting community', '最も面白い投票コミュニティに参加', 'auth', 'Subtitle description'),

-- Tab labels
('auth.tab.login', '登入', '登入', 'Login', 'ログイン', 'auth', 'Login tab label'),
('auth.tab.signup', '註冊', '註冊', 'Sign Up', '登録', 'auth', 'Signup tab label'),

-- Social login buttons
('auth.social.google', '使用 Google 登入', '使用 Google 登入', 'Sign in with Google', 'Googleでログイン', 'auth', 'Google login button'),
('auth.social.apple', '使用 Apple 登入', '使用 Apple 登入', 'Sign in with Apple', 'Appleでログイン', 'auth', 'Apple login button'),

-- Separator text
('auth.separator', '或使用電子郵件', '或使用電子郵件', 'Or use email', 'またはメールアドレスを使用', 'auth', 'Email separator text'),

-- Form labels
('auth.label.email', '電子郵件', '電子郵件', 'Email', 'メールアドレス', 'auth', 'Email field label'),
('auth.label.password', '密碼', '密碼', 'Password', 'パスワード', 'auth', 'Password field label'),
('auth.label.confirm_password', '確認密碼', '確認密碼', 'Confirm Password', 'パスワード確認', 'auth', 'Confirm password label'),

-- Placeholders
('auth.placeholder.email', 'your@email.com', 'your@email.com', 'your@email.com', 'your@email.com', 'auth', 'Email placeholder'),
('auth.placeholder.password', '••••••••', '••••••••', '••••••••', '••••••••', 'auth', 'Password placeholder'),
('auth.placeholder.password_hint', '至少 8 個字元，含大小寫字母和數字', '至少 8 個字元，含大小寫字母和數字', 'At least 8 characters with uppercase, lowercase and numbers', '大文字、小文字、数字を含む8文字以上', 'auth', 'Password input hint'),
('auth.placeholder.confirm_password', '請再次輸入密碼', '請再次輸入密碼', 'Enter password again', 'パスワードを再入力', 'auth', 'Confirm password placeholder'),

-- Password requirements
('auth.password.requirements', '密碼需包含: 大寫字母、小寫字母、數字 (8-72 字元)', '密碼需包含: 大寫字母、小寫字母、數字 (8-72 字元)', 'Password must contain: uppercase, lowercase, number (8-72 characters)', 'パスワード要件: 大文字、小文字、数字 (8-72文字)', 'auth', 'Password requirements text'),

-- Button labels
('auth.button.login', '登入', '登入', 'Login', 'ログイン', 'auth', 'Login button text'),
('auth.button.signup', '註冊', '註冊', 'Sign Up', '登録', 'auth', 'Signup button text'),

-- Success messages
('auth.success.login', '登入成功！', '登入成功！', 'Login successful!', 'ログイン成功！', 'auth', 'Login success message'),
('auth.success.signup', '註冊成功！正在登入...', '註冊成功！正在登入...', 'Sign up successful! Logging in...', '登録成功！ログイン中...', 'auth', 'Signup success message'),

-- Error messages
('auth.error.login_failed', '登入失敗，請稍後再試', '登入失敗，請稍後再試', 'Login failed, please try again later', 'ログインに失敗しました。後でもう一度お試しください', 'auth', 'Login error message'),
('auth.error.signup_failed', '註冊失敗，請稍後再試', '註冊失敗，請稍後再試', 'Sign up failed, please try again later', '登録に失敗しました。後でもう一度お試しください', 'auth', 'Signup error message'),
('auth.error.password_mismatch', '密碼不一致', '密碼不一致', 'Passwords do not match', 'パスワードが一致しません', 'auth', 'Password mismatch error'),
('auth.error.password_min_length', '密碼至少需要 8 個字元', '密碼至少需要 8 個字元', 'Password must be at least 8 characters', 'パスワードは8文字以上である必要があります', 'auth', 'Password min length error'),
('auth.error.password_max_length', '密碼最多 72 個字元', '密碼最多 72 個字元', 'Password must be at most 72 characters', 'パスワードは最大72文字です', 'auth', 'Password max length error'),
('auth.error.password_uppercase', '密碼需包含至少一個大寫字母', '密碼需包含至少一個大寫字母', 'Password must contain at least one uppercase letter', 'パスワードには少なくとも1つの大文字が必要です', 'auth', 'Password uppercase requirement error'),
('auth.error.password_lowercase', '密碼需包含至少一個小寫字母', '密碼需包含至少一個小寫字母', 'Password must contain at least one lowercase letter', 'パスワードには少なくとも1つの小文字が必要です', 'auth', 'Password lowercase requirement error'),
('auth.error.password_number', '密碼需包含至少一個數字', '密碼需包含至少一個數字', 'Password must contain at least one number', 'パスワードには少なくとも1つの数字が必要です', 'auth', 'Password number requirement error'),
('auth.error.email_registered', '此電子郵件已被註冊', '此電子郵件已被註冊', 'This email is already registered', 'このメールアドレスは既に登録されています', 'auth', 'Email already registered error'),
('auth.error.password_requirements', '密碼不符合安全要求', '密碼不符合安全要求', 'Password does not meet security requirements', 'パスワードがセキュリティ要件を満たしていません', 'auth', 'Password requirements not met error'),
('auth.error.google_login', 'Google登入失敗', 'Google登入失敗', 'Google login failed', 'Googleログインに失敗しました', 'auth', 'Google login error'),
('auth.error.apple_login', 'Apple登入失敗', 'Apple登入失敗', 'Apple login failed', 'Appleログインに失敗しました', 'auth', 'Apple login error')
ON CONFLICT (key) DO NOTHING;