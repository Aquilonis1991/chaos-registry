-- ==========================================
-- 快速驗證所有安全函數是否已創建
-- ==========================================

SELECT 
  proname as function_name,
  CASE 
    WHEN proname = 'increment_option_votes' THEN '✅ 代幣投票函數'
    WHEN proname = 'increment_free_vote' THEN '✅ 免費投票函數'
    WHEN proname = 'warn_direct_options_update' THEN '✅ 警告觸發器函數'
    ELSE proname
  END as description
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('increment_option_votes', 'increment_free_vote', 'warn_direct_options_update')
ORDER BY proname;

-- 如果上述查詢返回 3 行，表示所有函數都已創建 ✅

