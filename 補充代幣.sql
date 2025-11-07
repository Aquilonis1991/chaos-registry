-- 補充用戶代幣
-- 在 Supabase SQL Editor 執行此 SQL

-- 方法 1: 為所有用戶補充代幣（設定為 1000）
UPDATE public.profiles
SET tokens = 1000
WHERE tokens < 100;

-- 方法 2: 為特定用戶補充代幣（根據 email）
-- 請將 'your-email@example.com' 替換為您的實際 email
UPDATE public.profiles
SET tokens = 1000
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);

-- 方法 3: 為所有用戶都補充（無條件）
UPDATE public.profiles
SET tokens = 1000;

-- 查看結果
SELECT 
  p.id,
  u.email,
  p.nickname,
  p.tokens,
  p.created_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC;


