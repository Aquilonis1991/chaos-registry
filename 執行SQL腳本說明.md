# 執行 SQL 腳本添加 AdMob 配置

由於 migration 推送遇到錯誤，請直接在 Supabase Dashboard 執行以下 SQL：

## 步驟：

1. 打開 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的項目（votechaos）
3. 點擊左側的 **SQL Editor**
4. 複製並執行以下 SQL：

```sql
-- 添加 AdMob 點擊觀看廣告單元 ID 配置
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'admob_rewarded_ad_unit_id',
  'ca-app-pub-3940256099942544/5224354917',
  'advertising',
  'AdMob 點擊觀看廣告單元 ID（獎勵廣告）。Android 測試 ID: ca-app-pub-3940256099942544/5224354917，iOS 測試 ID: ca-app-pub-3940256099942544/1712485313'
)
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- 驗證配置是否已添加
SELECT key, value, category, description 
FROM public.system_config 
WHERE key = 'admob_rewarded_ad_unit_id';
```

5. 點擊 **Run** 執行
6. 刷新後台管理頁面（https://chaos-registry.vercel.app/admin），應該就能看到新的配置項

## 文件位置：

SQL 腳本已保存在：`sql_patches/20250127_add_admob_rewarded_ad_unit_id.sql`

