# 更新 AdMob 獎勵廣告配置為支持 Android/iOS 分別配置

## 問題說明

AdMob 的廣告單元 ID 在 Android 和 iOS 平台通常是**不同的**。每個平台都需要創建自己的廣告單元，並且會有不同的 ID。

## 解決方案

已修改配置系統，支持分別為 Android 和 iOS 設置不同的廣告單元 ID。

### 配置格式

配置項 `admob_rewarded_ad_unit_id` 現在支持兩種格式：

#### 格式 1：JSON 對象（推薦，支持分別配置）
```json
{
  "android": "ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY",
  "ios": "ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ"
}
```

#### 格式 2：字符串（兼容舊配置，兩個平台共用）
```
"ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY"
```

## 更新數據庫配置

請在 Supabase Dashboard 的 SQL Editor 中執行以下 SQL 來更新現有配置：

```sql
-- 更新 AdMob 點擊觀看廣告單元 ID 配置為支持 Android/iOS 分別配置
UPDATE public.system_config
SET 
  value = '{"android": "ca-app-pub-3940256099942544/5224354917", "ios": "ca-app-pub-3940256099942544/1712485313"}'::jsonb,
  description = 'AdMob 點擊觀看廣告單元 ID（獎勵廣告）。格式：{"android": "Android廣告單元ID", "ios": "iOS廣告單元ID"}。測試 ID：Android: ca-app-pub-3940256099942544/5224354917，iOS: ca-app-pub-3940256099942544/1712485313'
WHERE key = 'admob_rewarded_ad_unit_id';
```

## 在後台管理頁面編輯

1. 訪問：https://chaos-registry.vercel.app/admin
2. 點擊「系統配置」→「廣告配置」標籤
3. 找到 `admob_rewarded_ad_unit_id` 配置項
4. 編輯值為 JSON 格式：
   ```json
   {
     "android": "您的Android廣告單元ID",
     "ios": "您的iOS廣告單元ID"
   }
   ```
5. 點擊「儲存」

## 工作原理

- 應用會自動檢測當前運行平台（Android/iOS）
- 根據平台從配置中讀取對應的廣告單元 ID
- 如果配置是字符串格式，兩個平台會使用同一個 ID（兼容舊配置）
- 如果配置是對象格式，會根據平台使用對應的 ID

## 測試 ID

- **Android 測試 ID**: `ca-app-pub-3940256099942544/5224354917`
- **iOS 測試 ID**: `ca-app-pub-3940256099942544/1712485313`

## 注意事項

- 生產環境請替換為您在 AdMob 後台創建的實際廣告單元 ID
- Android 和 iOS 需要在 AdMob 後台分別創建廣告單元
- 配置更新後會立即生效，無需重啟應用


