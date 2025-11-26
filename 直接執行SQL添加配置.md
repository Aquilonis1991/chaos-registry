# 直接執行 SQL 添加 AdMob 配置

由於 migration 推送遇到舊 migration 錯誤，請直接在 Supabase Dashboard 執行以下 SQL：

## 快速執行步驟：

1. **打開 Supabase Dashboard**
   - 訪問：https://supabase.com/dashboard
   - 選擇項目：**votechaos**

2. **進入 SQL Editor**
   - 點擊左側選單的 **SQL Editor**

3. **複製並執行以下 SQL**：

```sql
-- 添加 AdMob 點擊觀看廣告單元 ID 配置
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'admob_rewarded_ad_unit_id',
  '"ca-app-pub-3940256099942544/5224354917"'::json,
  'advertising',
  'AdMob 點擊觀看廣告單元 ID（獎勵廣告）。Android 測試 ID: ca-app-pub-3940256099942544/5224354917，iOS 測試 ID: ca-app-pub-3940256099942544/1712485313'
)
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;
```

4. **點擊 "Run" 按鈕執行**

5. **驗證配置已添加**（可選）：

```sql
SELECT key, value, category, description 
FROM public.system_config 
WHERE key = 'admob_rewarded_ad_unit_id';
```

6. **刷新後台管理頁面**
   - 訪問：https://chaos-registry.vercel.app/admin
   - 點擊「系統配置」標籤
   - 應該會看到「廣告配置」標籤頁
   - 在「廣告配置」標籤頁中會看到 `admob_rewarded_ad_unit_id` 配置項

## 注意事項：

- 如果配置項已存在，`ON CONFLICT` 會更新現有配置
- 默認值為 Android 測試廣告 ID
- 生產環境請替換為您的實際 AdMob 廣告單元 ID

