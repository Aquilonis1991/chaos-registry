-- ==========================================
-- 修復主題選項格式問題
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- 問題：options 是字串陣列而不是物件陣列
-- 正確格式：[{"id": "uuid", "text": "選項A", "votes": 0}]
-- 錯誤格式：["選項A", "選項B"]

-- 方法 1：修復所有現有主題的 options 格式
UPDATE public.topics
SET options = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'text', 
        CASE 
          -- 如果是物件且有 text 欄位，保持原樣
          WHEN jsonb_typeof(option) = 'object' AND (option ? 'text') 
            THEN option->>'text'
          -- 如果是字串，直接使用
          WHEN jsonb_typeof(option) = 'string' 
            THEN option#>>'{}'
          ELSE 'Unknown'
        END,
      'votes', 
        CASE 
          -- 如果已有 votes，保持原值
          WHEN jsonb_typeof(option) = 'object' AND (option ? 'votes')
            THEN (option->>'votes')::int
          ELSE 0
        END
    )
  )
  FROM jsonb_array_elements(options) AS option
)
WHERE options IS NOT NULL AND jsonb_array_length(options) > 0;

-- 方法 2：如果上面的 SQL 失敗，使用這個簡單版本
-- DELETE FROM public.topics; -- 刪除所有主題，重新建立

-- 驗證修復結果
SELECT 
  id,
  title,
  jsonb_pretty(options) as formatted_options
FROM public.topics
LIMIT 5;

-- 檢查 options 結構
SELECT 
  '✅ 修復完成！' as status,
  COUNT(*) as total_topics,
  COUNT(*) FILTER (WHERE jsonb_typeof(options->0) = 'object') as correct_format,
  COUNT(*) FILTER (WHERE jsonb_typeof(options->0) = 'string') as wrong_format
FROM public.topics
WHERE options IS NOT NULL AND jsonb_array_length(options) > 0;


