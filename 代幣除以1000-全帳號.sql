-- 對所有帳號儲值 1000 代幣
-- ⚠️ 警告：此操作不可逆，請確認後再執行

-- 1. 先查看目前代幣分布（選用）
SELECT 
  id,
  nickname,
  tokens AS 目前代幣,
  tokens + 1000 AS 儲值1000後代幣
FROM public.profiles
ORDER BY tokens DESC
LIMIT 20;

-- 2. 執行儲值 1000 代幣操作
UPDATE public.profiles
SET tokens = tokens + 1000;

-- 3. 驗證結果（選用）
SELECT 
  '✅ 儲值1000代幣完成' as status,
  COUNT(*) as 帳號數量,
  SUM(tokens) as 總代幣,
  AVG(tokens) as 平均代幣,
  MIN(tokens) as 最少代幣,
  MAX(tokens) as 最多代幣
FROM public.profiles;

-- 4. 查看部分帳號結果（選用）
SELECT 
  id,
  nickname,
  tokens AS 儲值後代幣
FROM public.profiles
ORDER BY tokens DESC
LIMIT 20;

