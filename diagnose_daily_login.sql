-- ========================================
-- 診斷每日簽到狀態
-- 使用方法：在 Supabase SQL Editor 中執行此查詢
-- ========================================

-- 步驟 1：檢查用戶的簽到狀態（需要明確轉換 UUID 類型）
SELECT * FROM public.check_daily_login_status('08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid);

-- 步驟 2：如果需要重置今天的簽到記錄（僅用於測試）
-- SELECT * FROM public.reset_today_daily_login('08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid);

-- 步驟 3：手動檢查 daily_logins 表中的記錄
SELECT 
  user_id,
  login_date,
  created_at,
  (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE as today_taiwan,
  CASE 
    WHEN login_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE THEN '今天已簽到'
    ELSE '不是今天'
  END as status
FROM public.daily_logins
WHERE user_id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid
ORDER BY login_date DESC
LIMIT 10;

-- 步驟 4：檢查 profiles 表中的簽到相關欄位
SELECT 
  id,
  last_login_date,
  login_streak,
  total_login_days,
  tokens,
  (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE as today_taiwan,
  CASE 
    WHEN last_login_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE THEN '今天已簽到'
    WHEN last_login_date IS NULL THEN '從未簽到'
    ELSE '上次簽到：' || last_login_date::text
  END as login_status
FROM public.profiles
WHERE id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid;

