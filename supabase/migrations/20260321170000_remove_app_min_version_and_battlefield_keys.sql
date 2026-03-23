-- 1) 刪除 app_min_version（已由 app_min_version_android / app_min_version_ios 取代，useForceUpdate 僅讀取平台 key）
DELETE FROM public.system_config WHERE key = 'app_min_version';

-- 2) 刪除 battlefield 舊變數（程式無讀取；觀點角鬥場使用 arena_* 系列）
DELETE FROM public.system_config
WHERE key IN (
  'battlefield_breath_boost_amount',
  'battlefield_breath_boost_cost',
  'battlefield_mundane_decay_per_minute',
  'battlefield_throne_decay_per_minute'
);
