-- ==========================================
-- 檢查當前資料庫狀況
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- 1. 檢查所有主題
SELECT 
  '主題列表' as section,
  id,
  title,
  status,
  options,
  created_at
FROM public.topics
ORDER BY created_at DESC
LIMIT 5;

-- 2. 檢查 options 的資料類型（關鍵診斷）
SELECT 
  '選項格式診斷' as section,
  id,
  title,
  jsonb_array_length(options) as option_count,
  jsonb_typeof(options->0) as first_option_type,
  jsonb_pretty(options->0) as first_option_preview
FROM public.topics
WHERE options IS NOT NULL AND jsonb_array_length(options) > 0
LIMIT 10;

-- 3. 檢查選項結構問題
SELECT 
  '結構問題檢查' as section,
  COUNT(*) as total_topics,
  COUNT(*) FILTER (WHERE options IS NULL) as null_options,
  COUNT(*) FILTER (WHERE jsonb_array_length(options) = 0) as empty_options,
  COUNT(*) FILTER (
    WHERE options IS NOT NULL 
    AND jsonb_array_length(options) > 0 
    AND jsonb_typeof(options->0) = 'object'
  ) as correct_format,
  COUNT(*) FILTER (
    WHERE options IS NOT NULL 
    AND jsonb_array_length(options) > 0 
    AND jsonb_typeof(options->0) = 'string'
  ) as wrong_format_string,
  COUNT(*) FILTER (
    WHERE options IS NOT NULL 
    AND jsonb_array_length(options) > 0 
    AND jsonb_typeof(options->0) IS NULL
  ) as unknown_format
FROM public.topics;

-- 4. 檢查選項 ID 重複問題
SELECT 
  'ID 重複檢查' as section,
  id as topic_id,
  title,
  option_data->>'id' as option_id,
  COUNT(*) as duplicate_count
FROM public.topics,
     jsonb_array_elements(options) AS option_data
WHERE options IS NOT NULL
GROUP BY id, title, option_data->>'id'
HAVING COUNT(*) > 1;

-- 5. 檢查選項是否有正確的欄位
SELECT 
  '欄位完整性檢查' as section,
  id,
  title,
  option_data,
  (option_data ? 'id') as has_id,
  (option_data ? 'text') as has_text,
  (option_data ? 'votes') as has_votes
FROM public.topics,
     jsonb_array_elements(options) AS option_data
WHERE options IS NOT NULL
LIMIT 20;

-- 6. 顯示完整選項結構範例（診斷用）
SELECT 
  '完整結構範例' as section,
  id,
  title,
  jsonb_pretty(options) as full_options
FROM public.topics
WHERE options IS NOT NULL
LIMIT 3;

-- 7. 檢查用戶代幣
SELECT 
  '用戶代幣狀況' as section,
  id,
  nickname,
  tokens
FROM public.profiles
LIMIT 10;

