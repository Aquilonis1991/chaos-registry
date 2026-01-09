-- ==========================================
-- 系統配置完整驗證報告
-- 檢查所有系統配置是否正確反映到前台
-- ==========================================

-- ==========================================
-- 第一部分：任務配置與 missions 表對比
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
  '配置同步狀態' as section,
  cm.config_key,
  COALESCE(sc.value::text, '缺失') as system_config_value,
  cm.mission_id,
  COALESCE(m.reward::text, '缺失') as missions_table_reward,
  CASE 
    WHEN sc.value IS NULL AND m.reward IS NULL THEN '⚠️ 兩者都缺失'
    WHEN sc.value IS NULL THEN '⚠️ 系統配置缺失'
    WHEN m.reward IS NULL THEN '⚠️ 任務表缺失'
    WHEN CAST(sc.value::text AS INTEGER) = m.reward THEN '✓ 已同步'
    ELSE '✗ 未同步'
  END as sync_status
FROM config_mapping cm
LEFT JOIN public.system_config sc ON sc.key = cm.config_key
LEFT JOIN public.missions m ON m.id = cm.mission_id
ORDER BY cm.config_key;

-- ==========================================
-- 第二部分：任務目標配置檢查
-- ==========================================
SELECT 
  '任務目標配置' as section,
  key as config_key,
  value::text as config_value,
  description,
  CASE 
    WHEN key = 'mission_vote_lover_target' THEN '投票愛好者任務需要此配置（目標：10次）'
    WHEN key = 'mission_7days_login_target' THEN '7天登入任務需要此配置（目標：7天）'
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
-- 第三部分：其他系統配置檢查
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
-- 第四部分：關鍵配置值檢查
-- ==========================================
SELECT 
  '關鍵配置值' as section,
  key,
  value::text as current_value,
  description,
  CASE 
    WHEN key = 'mission_watch_ad_limit' THEN '每日觀看廣告上限（前台使用）'
    WHEN key = 'mission_watch_ad_reward' THEN '觀看廣告獎勵（前台顯示，後端發放）'
    WHEN key = 'mission_daily_login_reward' THEN '每日登入獎勵（前台顯示，後端發放）'
    WHEN key = 'new_user_tokens' THEN '新用戶初始代幣（註冊時使用）'
    WHEN key = 'title_max_length' THEN '主題標題最大字數（創建主題時驗證）'
    WHEN key = 'option_max_count' THEN '選項最大數量（創建主題時驗證）'
    WHEN key = 'vote_max_amount' THEN '單次投票最大數量（投票時驗證）'
    WHEN key = 'exposure_costs' THEN '曝光方案成本（創建主題時顯示）'
    ELSE '其他配置'
  END as usage_location
FROM public.system_config
WHERE key IN (
  'mission_watch_ad_limit',
  'mission_watch_ad_reward',
  'mission_daily_login_reward',
  'new_user_tokens',
  'title_max_length',
  'option_max_count',
  'vote_max_amount',
  'exposure_costs'
)
ORDER BY key;

-- ==========================================
-- 第五部分：配置完整性總結
-- ==========================================
SELECT 
  '配置完整性總結' as section,
  '任務配置總數' as metric,
  COUNT(*)::text as value
FROM public.system_config
WHERE category = 'mission' OR key LIKE 'mission_%'
UNION ALL
SELECT 
  '配置完整性總結',
  '任務表記錄數',
  COUNT(*)::text
FROM public.missions
UNION ALL
SELECT 
  '配置完整性總結',
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
  END
UNION ALL
SELECT 
  '配置完整性總結',
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
      UNION ALL SELECT 'mission_daily_login_reward'
    ) AS required
    WHERE NOT EXISTS (
      SELECT 1 FROM public.system_config WHERE system_config.key = required.key
    )
  );


