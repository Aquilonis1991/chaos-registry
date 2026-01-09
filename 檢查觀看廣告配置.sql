-- ==========================================
-- 檢查觀看廣告配置
-- 確認後台設定的獎勵值
-- ==========================================

-- 1. 檢查觀看廣告相關的系統配置
SELECT 
  '觀看廣告配置' as section,
  key as config_key,
  value as config_value,
  value::text as config_value_text,
  pg_typeof(value)::text as value_type,
  description
FROM public.system_config
WHERE key IN (
  'mission_watch_ad_reward',
  'mission_watch_ad_limit',
  'ad_reward_amount',
  'max_ads_per_day',
  'watch_ad_reward'
)
ORDER BY key;

-- 2. 檢查 missions 表中的觀看廣告任務
SELECT 
  '觀看廣告任務表' as section,
  id as mission_id,
  name as mission_name,
  reward as mission_reward,
  limit_per_day
FROM public.missions
WHERE id = 'watch_ad';

-- 3. 對比配置與任務表
SELECT 
  '配置對比' as section,
  'system_config' as source,
  'mission_watch_ad_reward' as config_key,
  value::text as value
FROM public.system_config
WHERE key = 'mission_watch_ad_reward'
UNION ALL
SELECT 
  '配置對比',
  'missions 表',
  'watch_ad',
  reward::text
FROM public.missions
WHERE id = 'watch_ad';

-- 4. 檢查配置值的實際類型
SELECT 
  '配置值類型檢查' as section,
  key,
  value,
  jsonb_typeof(value) as jsonb_type,
  value::text as text_value,
  CASE 
    WHEN jsonb_typeof(value) = 'number' THEN value::text
    WHEN jsonb_typeof(value) = 'string' THEN value::text
    ELSE 'unknown'
  END as parsed_value
FROM public.system_config
WHERE key = 'mission_watch_ad_reward';


