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

---

*紀錄日期：依本檔案建立／更新日為準。*
