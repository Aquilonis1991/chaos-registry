-- 強制更新：最低 App 版本與商店連結
-- 當 App 當前版本 < app_min_version 時，會顯示全螢幕「請更新」並導向商店
-- app_min_version 留空則不強制更新
INSERT INTO public.system_config (key, value, category, description)
VALUES
  (
    'app_min_version',
    '""'::jsonb,
    'app',
    '最低 App 版本號（如 1.0.48）。留空則不強制更新。僅原生 App 會檢查。'
  ),
  (
    'app_store_url_android',
    '""'::jsonb,
    'app',
    'Android 商店連結（選填）。未填則使用預設 Google Play 連結。'
  ),
  (
    'app_store_url_ios',
    '""'::jsonb,
    'app',
    'iOS App Store 連結（選填）。未填則使用預設連結，上架後請改為實際連結。'
  )
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;
