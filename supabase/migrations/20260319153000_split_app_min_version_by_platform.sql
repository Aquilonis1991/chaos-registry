-- 強制更新最低版本改為平台分流（Android / iOS）
-- 若舊 key app_min_version 已有值，會同步預填到新 key，避免切換期間失效

DO $$
DECLARE
  v_old text := '';
BEGIN
  SELECT COALESCE(value #>> '{}', '')
    INTO v_old
  FROM public.system_config
  WHERE key = 'app_min_version'
  LIMIT 1;

  INSERT INTO public.system_config (key, value, category, description)
  VALUES
    (
      'app_min_version_android',
      to_jsonb(v_old),
      'user',
      'Android 最低 App 版本號（如 1.0.48）。留空則不強制更新。僅原生 App 會檢查。'
    ),
    (
      'app_min_version_ios',
      to_jsonb(v_old),
      'user',
      'iOS 最低 App 版本號（如 1.0.48）。留空則不強制更新。僅原生 App 會檢查。'
    )
  ON CONFLICT (key) DO NOTHING;
END $$;

