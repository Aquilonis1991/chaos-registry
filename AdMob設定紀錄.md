# AdMob 設定紀錄

本檔案紀錄專案使用的 AdMob 應用程式與廣告單元 ID，供建置與後台設定參考。

---

## 應用程式 ID (App ID)

| 平台 | ID |
|------|-----|
| **Android** | `ca-app-pub-9731699243657023~2885273855` |
| **iOS** | `ca-app-pub-9731699243657023~6272597284` |

---

## 廣告單元 ID (Ad Unit IDs)

### 原生進階 (Native Advanced) — 首頁／列表原生廣告卡片

| 平台 | ID |
|------|-----|
| **Android** | `ca-app-pub-9731699243657023/9233792805` |
| **iOS** | `ca-app-pub-9731699243657023/6575849617` |

### 獎勵廣告 (Rewarded) — 每日任務「觀看廣告」獲失序值

| 平台 | ID |
|------|-----|
| **Android** | `ca-app-pub-9731699243657023/2441163484` |
| **iOS** | `ca-app-pub-9731699243657023/7370056530` |

---

## 設定位置參考

- **Android**：應用程式 ID 設於 `android/app/src/main/AndroidManifest.xml`；廣告單元 ID 可由後台 `system_config`（如 `admob_native_ad_unit_id`、`admob_rewarded_ad_unit_id`）控制。
- **iOS**：應用程式 ID 設於 `ios/App/App/Info.plist`（GADApplicationIdentifier）；廣告單元 ID 可由後台 `system_config` 或 Info.plist 對應 key 控制。
- **後台**：若使用 `system_config`，可存 JSON 區分平台，例如獎勵廣告：`{"android": "ca-app-pub-9731699243657023/2441163484", "ios": "ca-app-pub-9731699243657023/7370056530"}`。

### 原生廣告單元 ID 是否區分 iOS／Android？

**要。** AdMob 後台會為 Android 與 iOS 各建立一個原生廣告單元，建議在 `system_config` 依平台分開設定：

| 設定方式 | value 範例 | 說明 |
|----------|-------------|------|
| 單一 ID（兩平台共用） | `"ca-app-pub-XXX/YYY"` | 字串，Android 與 iOS 使用同一個 ID（較少見） |
| **依平台分開（建議）** | `{"android":"ca-app-pub-XXX/AAA","ios":"ca-app-pub-XXX/BBB"}` | JSON 物件，Android 用 `android`，iOS 用 `ios` |

程式會依目前平台自動選用對應 ID；未設定時會使用 Google 測試 ID（Android: `2247696110`，iOS: `3986624511`）。

**Supabase SQL Editor 範例**（貼上後依實際 ID 修改）：

```sql
-- 方式一：依平台分開（建議）
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'admob_native_ad_unit_id',
  '{"android":"ca-app-pub-9731699243657023/9233792805","ios":"ca-app-pub-9731699243657023/6575849617"}'::jsonb,
  'ad',
  'AdMob 原生廣告單元 ID（可區分 Android / iOS）'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

-- 方式二：單一 ID（兩平台共用）
-- INSERT INTO public.system_config (key, value, category, description)
-- VALUES (
--   'admob_native_ad_unit_id',
--   '"ca-app-pub-3940256099942544/2247696110"'::jsonb,
--   'ad',
--   'AdMob 原生廣告單元 ID（測試）'
-- )
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;
```

---

*紀錄日期：依本檔案建立／更新日為準。*
