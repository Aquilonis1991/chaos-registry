# 📱 AdMob 正式環境配置檔案 (Production Config)

此檔案歸檔了上線前需在 Google AdMob 後台建立的正式廣告單元設定。

> **狀態**: 待建立  
> **更新日期**: 2026-01-07

---

## 1. 獎勵廣告 (Rewarded Video)

此廣告單元用於「每日任務」中的「觀看廣告獲取代幣」功能。

### 🤖 Android 版設定

| 設定項目 | 建議值 | 說明 |
| :--- | :--- | :--- |
| **廣告單元名稱** | **Token_Reward_Video_Android** | 代幣獎勵廣告 - Android |
| **廣告格式** | 獎勵廣告 (Rewarded) | |
| **合作夥伴出價** | 不勾選 | 除非使用第三方 Mediation |
| **獎勵數量** | `5` | 與 APP 內邏輯保持一致 |
| **獎勵項目** | `Tokens` (或 `代幣`) | 使用者看廣告時顯示的獎勵名稱 |
| **伺服器端驗證 (SSV)** | (選填) | 若需更嚴格驗證可開啟，需配合後端回調 |

### 🍎 iOS 版設定

| 設定項目 | 建議值 | 說明 |
| :--- | :--- | :--- |
| **廣告單元名稱** | **Token_Reward_Video_iOS** | 代幣獎勵廣告 - iOS |
| **廣告格式** | 獎勵廣告 (Rewarded) | |
| **合作夥伴出價** | 不勾選 | |
| **獎勵數量** | `5` | |
| **獎勵項目** | `Tokens` (或 `代幣`) | |

---

## 2. 應用程式 ID (App IDs)

申請 AdMob 帳號後，請在此填入正式的 App ID：

*   **Android App ID**: `(尚未申請)`
*   **iOS App ID**: `(尚未申請)`

---

## 3. 其他廣告單元 (預留)

若未來啟用 Banner 或插頁廣告，請依此命名規則建立：

### Banner 廣告 (首頁/列表)
*   Android: `Banner_Home_Android`
*   iOS: `Banner_Home_iOS`

### 插頁廣告 (轉場/投票後)
*   Android: `Interstitial_Vote_Android`
*   iOS: `Interstitial_Vote_iOS`

---

## ⚠️ 上線前檢查清單

1.  [ ] 在 AdMob 後台建立上述廣告單元。
2.  [ ] 取得正式的 **App ID** 與 **Ad Unit ID**。
3.  [ ] 在 Supabase 後台 `system_config` 表中設定 `admob_rewarded_ad_unit_id`。
    *   值為 JSON 格式：`{"android": "ca-app-pub-xxx/xxx", "ios": "ca-app-pub-xxx/xxx"}`
4.  [ ] 更新程式碼中的 App ID (AndroidManifest.xml / Info.plist)。
