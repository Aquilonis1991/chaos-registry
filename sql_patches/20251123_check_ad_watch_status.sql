-- ==========================================
-- 檢查觀看廣告狀態和配置
-- ==========================================

-- 1. 查看當前用戶的觀看次數（使用 auth.uid()，不需要參數）
SELECT 
  id,
  nickname,
  tokens,
  ad_watch_count,
  last_login,
  CASE 
    WHEN last_login::date = CURRENT_DATE THEN ad_watch_count
    ELSE 0
  END as today_watch_count,
  CASE 
    WHEN last_login::date = CURRENT_DATE AND ad_watch_count >= 30 THEN '✅ 已達上限（30次）'
    WHEN last_login::date = CURRENT_DATE THEN CONCAT('還可觀看 ', 30 - ad_watch_count, ' 次')
    ELSE '今日尚未觀看'
  END as status
FROM public.profiles
WHERE id = auth.uid();

-- 2. 如果 auth.uid() 返回 NULL，使用直接指定用戶 ID 的方式
-- 替換 '08fc94c1-bfb3-47ed-9191-b46fa24837f2' 為你的實際用戶 ID
SELECT 
  id,
  nickname,
  tokens,
  ad_watch_count,
  last_login,
  CASE 
    WHEN last_login::date = CURRENT_DATE THEN ad_watch_count
    ELSE 0
  END as today_watch_count,
  CASE 
    WHEN last_login::date = CURRENT_DATE AND ad_watch_count >= 30 THEN '✅ 已達上限（30次）'
    WHEN last_login::date = CURRENT_DATE THEN CONCAT('還可觀看 ', 30 - ad_watch_count, ' 次')
    ELSE '今日尚未觀看'
  END as status
FROM public.profiles
WHERE id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2';

-- 3. 查看配置值
SELECT 
  key,
  value,
  description,
  updated_at
FROM public.system_config
WHERE key IN ('max_ads_per_day', 'mission_watch_ad_limit', 'ad_reward_amount', 'mission_watch_ad_reward')
ORDER BY key;

-- 4. 查看今日的觀看記錄
SELECT 
  created_at,
  amount,
  description
FROM public.token_transactions
WHERE transaction_type = 'watch_ad'
  AND created_at::date = CURRENT_DATE
  AND user_id = auth.uid() -- 或替換為 '08fc94c1-bfb3-47ed-9191-b46fa24837f2'
ORDER BY created_at DESC;

-- 5. 重置觀看次數（僅用於測試）
-- 取消註釋下面的語句來重置觀看次數
-- UPDATE public.profiles
-- SET ad_watch_count = 0
-- WHERE id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2';

