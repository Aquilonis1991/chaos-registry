-- ==========================================
-- 任務系統配置診斷報告
-- 檢查任務所需條件、獎勵數量是否正確讀取系統配置
-- 以及系統配置是否正確反映到前台
-- ==========================================

-- ==========================================
-- 第一部分：檢查任務相關的系統配置
-- ==========================================
SELECT 
  '任務系統配置' as section,
  key as config_key,
  value as config_value,
  category,
  description
FROM public.system_config
WHERE category = 'mission'
   OR key LIKE 'mission_%'
ORDER BY key;

-- ==========================================
-- 第二部分：檢查 missions 表的數據
-- ==========================================
SELECT 
  '任務表數據' as section,
  id as mission_id,
  name as mission_name,
  condition as mission_condition,
  reward as mission_reward,
  limit_per_day
FROM public.missions
ORDER BY id;

-- ==========================================
-- 第三部分：對比系統配置與 missions 表的獎勵
-- ==========================================
WITH config_mapping AS (
  SELECT 'mission_first_vote_reward' as config_key, 'first_vote' as mission_id, '新手上路' as mission_name
  UNION ALL SELECT 'mission_vote_lover_reward', 'vote_lover', '投票愛好者'
  UNION ALL SELECT 'mission_create_topic_reward', 'topic_creator', '話題創造者'
  UNION ALL SELECT 'mission_7days_login_reward_tokens', 'login_7days', '7天登入'
  UNION ALL SELECT 'mission_watch_ad_reward', 'watch_ad', '觀看廣告'
  UNION ALL SELECT 'mission_daily_login_reward', 'daily_login', '每日登入'
  UNION ALL SELECT 'daily_login_reward', 'daily_login', '每日登入（舊配置）'
)
SELECT 
  '配置對比' as section,
  cm.config_key,
  COALESCE(sc.value::text, '缺失') as system_config_value,
  cm.mission_id,
  COALESCE(m.name, cm.mission_name) as mission_name,
  COALESCE(m.reward::text, '缺失') as missions_table_reward,
  CASE 
    WHEN sc.value IS NULL AND m.reward IS NULL THEN '⚠️ 兩者都缺失'
    WHEN sc.value IS NULL THEN '⚠️ 系統配置缺失'
    WHEN m.reward IS NULL THEN '⚠️ 任務表缺失'
    WHEN CAST(sc.value::text AS INTEGER) = m.reward THEN '✓ 一致'
    ELSE '✗ 不一致'
  END as status,
  CASE 
    WHEN sc.value IS NOT NULL AND m.reward IS NOT NULL 
         AND CAST(sc.value::text AS INTEGER) != m.reward 
    THEN '需要同步：系統配置=' || sc.value::text || ', 任務表=' || m.reward::text
    ELSE NULL
  END as sync_note
FROM config_mapping cm
LEFT JOIN public.system_config sc ON sc.key = cm.config_key
LEFT JOIN public.missions m ON m.id = cm.mission_id
ORDER BY cm.config_key;

-- ==========================================
-- 第四部分：檢查任務目標條件配置
-- ==========================================
SELECT 
  '任務目標配置' as section,
  key as config_key,
  value as config_value,
  description,
  CASE 
    WHEN key = 'mission_vote_lover_target' THEN '投票愛好者任務需要此配置'
    WHEN key = 'mission_7days_login_target' THEN '7天登入任務需要此配置'
    ELSE '其他任務配置'
  END as usage_note
FROM public.system_config
WHERE key IN (
  'mission_vote_lover_target',
  'mission_7days_login_target',
  'consecutive_login_target'
)
ORDER BY key;

-- ==========================================
-- 第五部分：檢查同步函數是否存在
-- ==========================================
SELECT 
  '同步函數檢查' as section,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  CASE 
    WHEN p.proname = 'sync_mission_rewards_from_config' THEN '✓ 同步函數存在'
    ELSE '⚠️ 需要檢查'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'sync_mission_rewards_from_config';

-- ==========================================
-- 第六部分：檢查觸發器是否設置
-- ==========================================
SELECT 
  '同步觸發器檢查' as section,
  t.tgname as trigger_name,
  c.relname as table_name,
  CASE 
    WHEN t.tgname = 'trigger_sync_mission_rewards' THEN '✓ 觸發器存在'
    ELSE '⚠️ 觸發器缺失'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'system_config'
  AND t.tgname = 'trigger_sync_mission_rewards'
  AND NOT t.tgisinternal;

-- ==========================================
-- 第七部分：檢查前端需要的所有配置是否存在
-- ==========================================
SELECT 
  '前端配置完整性檢查' as section,
  'mission_first_vote_reward' as required_config,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.system_config WHERE key = 'mission_first_vote_reward') 
    THEN '✓ 存在'
    ELSE '✗ 缺失'
  END as status,
  (SELECT value::text FROM public.system_config WHERE key = 'mission_first_vote_reward' LIMIT 1) as current_value
UNION ALL
SELECT 
  '前端配置完整性檢查',
  'mission_vote_lover_target',
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.system_config WHERE key = 'mission_vote_lover_target') 
    THEN '✓ 存在'
    ELSE '✗ 缺失'
  END,
  (SELECT value::text FROM public.system_config WHERE key = 'mission_vote_lover_target' LIMIT 1)
UNION ALL
SELECT 
  '前端配置完整性檢查',
  'mission_vote_lover_reward',
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.system_config WHERE key = 'mission_vote_lover_reward') 
    THEN '✓ 存在'
    ELSE '✗ 缺失'
  END,
  (SELECT value::text FROM public.system_config WHERE key = 'mission_vote_lover_reward' LIMIT 1)
UNION ALL
SELECT 
  '前端配置完整性檢查',
  'mission_create_topic_reward',
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.system_config WHERE key = 'mission_create_topic_reward') 
    THEN '✓ 存在'
    ELSE '✗ 缺失'
  END,
  (SELECT value::text FROM public.system_config WHERE key = 'mission_create_topic_reward' LIMIT 1)
UNION ALL
SELECT 
  '前端配置完整性檢查',
  'mission_7days_login_target',
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.system_config WHERE key = 'mission_7days_login_target') 
    THEN '✓ 存在'
    ELSE '✗ 缺失'
  END,
  (SELECT value::text FROM public.system_config WHERE key = 'mission_7days_login_target' LIMIT 1)
UNION ALL
SELECT 
  '前端配置完整性檢查',
  'mission_7days_login_reward_tokens',
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.system_config WHERE key = 'mission_7days_login_reward_tokens') 
    THEN '✓ 存在'
    ELSE '✗ 缺失'
  END,
  (SELECT value::text FROM public.system_config WHERE key = 'mission_7days_login_reward_tokens' LIMIT 1)
UNION ALL
SELECT 
  '前端配置完整性檢查',
  'mission_watch_ad_reward',
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.system_config WHERE key = 'mission_watch_ad_reward') 
    THEN '✓ 存在'
    ELSE '✗ 缺失'
  END,
  (SELECT value::text FROM public.system_config WHERE key = 'mission_watch_ad_reward' LIMIT 1)
UNION ALL
SELECT 
  '前端配置完整性檢查',
  'mission_watch_ad_limit',
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.system_config WHERE key = 'mission_watch_ad_limit') 
    THEN '✓ 存在'
    ELSE '✗ 缺失'
  END,
  (SELECT value::text FROM public.system_config WHERE key = 'mission_watch_ad_limit' LIMIT 1)
UNION ALL
SELECT 
  '前端配置完整性檢查',
  'mission_daily_login_reward',
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.system_config WHERE key = 'mission_daily_login_reward') 
    THEN '✓ 存在'
    ELSE '✗ 缺失'
  END,
  (SELECT value::text FROM public.system_config WHERE key = 'mission_daily_login_reward' LIMIT 1)
ORDER BY required_config;

-- ==========================================
-- 第八部分：檢查其他系統配置是否正確
-- ==========================================
SELECT 
  '其他系統配置' as section,
  category,
  COUNT(*) as config_count,
  string_agg(key, ', ' ORDER BY key) as config_keys
FROM public.system_config
WHERE category IN ('recharge', 'validation', 'voting', 'topic_cost', 'user')
GROUP BY category
ORDER BY category;

-- ==========================================
-- 第九部分：檢查配置值的數據類型
-- ==========================================
SELECT 
  '配置數據類型檢查' as section,
  key,
  value,
  pg_typeof(value)::text as value_type,
  CASE 
    WHEN pg_typeof(value)::text = 'jsonb' THEN 'JSONB (需要解析)'
    WHEN pg_typeof(value)::text = 'text' THEN 'TEXT (字符串)'
    WHEN pg_typeof(value)::text = 'integer' THEN 'INTEGER (整數)'
    WHEN pg_typeof(value)::text = 'numeric' THEN 'NUMERIC (數字)'
    ELSE '其他類型: ' || pg_typeof(value)::text
  END as type_note
FROM public.system_config
WHERE key LIKE 'mission_%'
ORDER BY key;

-- ==========================================
-- 第十部分：總結報告
-- ==========================================
SELECT 
  '診斷總結' as section,
  '任務配置總數' as metric,
  COUNT(*)::text as value
FROM public.system_config
WHERE category = 'mission' OR key LIKE 'mission_%'
UNION ALL
SELECT 
  '診斷總結',
  '任務表記錄數',
  COUNT(*)::text
FROM public.missions
UNION ALL
SELECT 
  '診斷總結',
  '配置缺失數量',
  (
    SELECT COUNT(*)::text
    FROM (
      SELECT 'mission_first_vote_reward' as key
      UNION ALL SELECT 'mission_vote_lover_target'
      UNION ALL SELECT 'mission_vote_lover_reward'
      UNION ALL SELECT 'mission_create_topic_reward'
      UNION ALL SELECT 'mission_7days_login_target'
      UNION ALL SELECT 'mission_7days_login_reward_tokens'
      UNION ALL SELECT 'mission_watch_ad_reward'
      UNION ALL SELECT 'mission_watch_ad_limit'
    ) AS required
    WHERE NOT EXISTS (
      SELECT 1 FROM public.system_config WHERE system_config.key = required.key
    )
  )
UNION ALL
SELECT 
  '診斷總結',
  '同步函數狀態',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' 
      AND p.proname = 'sync_mission_rewards_from_config'
    ) THEN '✓ 已設置'
    ELSE '✗ 未設置'
  END
UNION ALL
SELECT 
  '診斷總結',
  '同步觸發器狀態',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
      AND c.relname = 'system_config'
      AND t.tgname = 'trigger_sync_mission_rewards'
      AND NOT t.tgisinternal
    ) THEN '✓ 已設置'
    ELSE '✗ 未設置'
  END;

