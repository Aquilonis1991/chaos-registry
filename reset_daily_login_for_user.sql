-- ========================================
-- 重置用戶今天的簽到記錄
-- 使用方法：在 Supabase SQL Editor 中執行此查詢
-- ========================================

-- 步驟 1：檢查當前狀態
SELECT * FROM public.check_daily_login_status('08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid);

-- 步驟 2：重置今天的簽到記錄
SELECT * FROM public.reset_today_daily_login('08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid);

-- 步驟 3：再次檢查狀態（確認已重置）
SELECT * FROM public.check_daily_login_status('08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid);

-- 步驟 4：手動重置（如果函數不工作，使用這個）
-- UPDATE public.profiles
-- SET last_login_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE - INTERVAL '1 day'
-- WHERE id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid
--   AND last_login_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::DATE;

