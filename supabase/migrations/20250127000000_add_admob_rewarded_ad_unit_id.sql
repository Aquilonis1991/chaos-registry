-- 添加 AdMob 點擊觀看廣告單元 ID 配置（支持 Android 和 iOS 分別配置）
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'admob_rewarded_ad_unit_id',
  '{"android": "ca-app-pub-3940256099942544/5224354917", "ios": "ca-app-pub-3940256099942544/1712485313"}'::jsonb,
  'advertising',
  'AdMob 點擊觀看廣告單元 ID（獎勵廣告）。格式：{"android": "Android廣告單元ID", "ios": "iOS廣告單元ID"}。測試 ID：Android: ca-app-pub-3940256099942544/5224354917，iOS: ca-app-pub-3940256099942544/1712485313'
)
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

