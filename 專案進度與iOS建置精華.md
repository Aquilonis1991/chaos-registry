# 專案進度與 iOS 建置精華

本檔案整理：**目前專案進度**、**iOS 建置所需**、**Apple 內購串接**、**第三方登入確認**、**偽裝成原生 App**。供 Mac 上建置 iOS 時依序檢查與實作。

---

## 一、目前專案進度

### 版本與分支

| 項目 | 狀態 |
|------|------|
| **版本號** | 1.0.48（package.json，與 Android 同步） |
| **遠端分支** | android、main、ios 已同步 |
| **Android** | AAB 已建置（bundleRelease），可上架 Google Play |
| **iOS** | 專案已建立（Capacitor），需在 **macOS** 上建置與上架 |

### 已完成功能（與 iOS 相關）

| 功能 | 狀態 | 備註 |
|------|------|------|
| 主題／投票／發起／曝光／失序值 | ✅ | 前後端已就緒 |
| 儲值（內購） | ✅ 前端＋後端 | Android 走 Google Play；iOS 需在 App Store Connect 建立產品並串接 |
| 強制更新 | ✅ | system_config `app_min_version`，僅原生 App 檢查 |
| 廣告（AdMob） | ✅ | 獎勵／原生進階／Banner；iOS 用 Info.plist GADApplicationIdentifier |
| 第三方登入 | ✅ 前端＋Edge Functions | Google、Apple、X (Twitter)、LINE；iOS 需確認 URL Scheme／Capability |
| 偽裝原生 | ✅ 部分 | Splash／StatusBar／safe-area／tap 高亮／overscroll／選取控制 |

### 關鍵檔案位置

| 用途 | 路徑 |
|------|------|
| 產品 ID 對應（內購） | `src/lib/purchase.ts`（PRODUCT_ID_MAP：token_pack_small/medium/large/xlarge） |
| 購買流程 | `src/hooks/usePurchase.tsx`（呼叫 verify-google-play-purchase / verify-app-store-purchase） |
| Apple 內購驗證 | `supabase/functions/verify-app-store-purchase/index.ts` |
| 登入按鈕與 OAuth | `src/pages/AuthPage.tsx`（handleSocialLogin：google/apple/x；handleEdgeSocialLogin：line） |
| Deep Link 回調 | `ios/App/App/Info.plist`（CFBundleURLSchemes：votechaos） |
| 原生感設定 | `capacitor.config.ts`、`index.html`（theme-color、meta）、`src/index.css`（capacitor-native）、`src/lib/capacitor.ts` |

---

## 二、iOS 建置所需（Mac 上）

### 環境

| 項目 | 說明 |
|------|------|
| **macOS** | 必須（Xcode 僅支援 macOS） |
| **Node.js** | 18+（`node -v`） |
| **Xcode** | 最新穩定版，Command Line Tools：`xcode-select --install` |
| **CocoaPods** | `sudo gem install cocoapods` 或 `brew install cocoapods` |
| **專案** | `git clone` 後 `git checkout ios`，或從 USB 還原後 `git pull origin ios` |

### 建置指令（首次與後續）

```bash
cd ~/Documents/votechaos-main   # 你的專案路徑
npm install
npm run build
npx cap sync ios
cd ios/App && pod install && cd ../..
npm run ios
```

在 Xcode：選模擬器或實機 → Product → Run (⌘R)。

### 憑證與描述檔（上架用）

- **Apple Developer**：帳號、Team ID、Bundle ID（如 `com.votechaos.app`）。
- **Signing & Capabilities**：在 Xcode 專案中設定 Development / Distribution 憑證與 Provisioning Profile。
- **App Store Connect**：建立 App、填寫資訊、準備審核用截圖與說明。

---

## 三、Apple 內購串接（iOS）

### 3.1 前端與後端現狀

| 項目 | 狀態 | 說明 |
|------|------|------|
| 產品 ID | ✅ | token_pack_small、token_pack_medium、token_pack_large、token_pack_xlarge（與 `purchase.ts` 一致） |
| 購買流程 | ✅ | cordova-plugin-purchase → 購買成功後呼叫 `verify-app-store-purchase` |
| 後端驗證 | ✅ | Edge Function 使用 Apple verifyReceipt API（需 APP_STORE_SHARED_SECRET） |

### 3.2 待完成／需確認

| 項目 | 說明 |
|------|------|
| **App Store Connect 產品** | 在 App Store Connect → 你的 App → App 內購買項目 → 建立四個「消耗型」產品，ID 與上表一致。 |
| **Shared Secret** | App Store Connect → 你的 App → App 內購買項目 → 管理 → 共用密鑰；將此值設為 Supabase Secret：`APP_STORE_SHARED_SECRET`。 |
| **後端參數對齊** | ✅ 已處理：後端已接受 `receiptData ?? purchaseToken`，前端送 `purchaseToken`（iOS 收據字串）即可。 |
| **沙盒測試** | 在 App Store Connect 建立沙盒測試帳號，裝置登出 Apple ID 後於 App 內購時選「沙盒」登入。 |
| **正式環境** | 上架後後端 verifyReceipt 網址為 `https://buy.itunes.apple.com/verifyReceipt`；沙盒為 `https://sandbox.itunes.apple.com/verifyReceipt`（可依 status 21007 自動改送沙盒）。 |

### 3.3 Supabase Secrets（Apple 內購）

```bash
npx supabase secrets set APP_STORE_SHARED_SECRET=你的共用密鑰
npx supabase functions deploy verify-app-store-purchase
```

### 3.4 Xcode 專案

- **Capabilities**：在 Xcode 中為 App 加上 **In-App Purchase**。
- **StoreKit**：cordova-plugin-purchase 會使用 StoreKit 2；若遇問題可查 Podfile 與套件版本。

---

## 四、第三方登入確認（iOS）

### 4.1 已支援管道

| 管道 | 前端 | 後端 | iOS 備註 |
|------|------|------|----------|
| **Google** | Supabase signInWithOAuth('google') | Supabase 內建 | 需在 Google Cloud 設定 iOS 客戶端（Bundle ID），並在 Supabase Auth 設定中填入 iOS URL Scheme（若需）。 |
| **Apple** | signInWithOAuth('apple') | Supabase 內建 | 需在 Xcode 加上 **Sign in with Apple** Capability；Apple Developer 後台 App ID 啟用 Sign in with Apple。 |
| **X (Twitter)** | Edge Function twitter-auth | twitter-auth 回調 | 回調會導向 votechaos://auth/callback；確認 Info.plist 的 CFBundleURLSchemes 為 votechaos。 |
| **LINE** | Edge Function line-auth | line-auth 回調 | 同上，回調導向 Deep Link；LINE 開發者後台需設定 Callback URL（含 scheme）。 |

### 4.2 iOS 端檢查清單

| 項目 | 位置 | 說明 |
|------|------|------|
| **URL Scheme** | Info.plist → CFBundleURLTypes → votechaos | 供 OAuth 回調開啟 App（votechaos://auth/callback）。 |
| **Sign in with Apple** | Xcode → Signing & Capabilities | 新增「Sign in with Apple」。 |
| **Google** | Google Cloud Console | 新增 iOS 應用程式，Bundle ID：com.votechaos.app；下載 GoogleService-Info.plist 若專案有使用。 |
| **LINE** | LINE Developers | Callback URL 需含可開啟 App 的 scheme（例如 https 先導向再轉 votechaos://）。 |
| **ATS** | Info.plist → NSAppTransportSecurity | 專案已允許 supabase.co；若有其他網域需一併設定。 |

### 4.3 測試建議

- 在實機或模擬器上依序測試：Apple → Google → X → LINE。
- 確認登入後會回到 App（Deep Link）且 session 正確（可進入需登入的頁面）。

---

## 五、偽裝成原生 App（已做與可加強）

### 5.1 已實作

| 項目 | 說明 |
|------|------|
| **SplashScreen** | capacitor.config.ts：全螢幕、品牌色 #1a2332、launchShowDuration 600ms。 |
| **StatusBar** | 深色樣式、背景 #1a2332，與 Splash 一致。 |
| **Safe Area** | 各頁 header / bottom 使用 env(safe-area-inset-top/bottom)。 |
| **theme-color** | index.html meta theme-color（淺／深色）。 |
| **全螢幕／PWA 感** | apple-mobile-web-app-capable、viewport-fit=cover、mobile-web-app-capable。 |
| **點擊與長按** | -webkit-tap-highlight-color: transparent；-webkit-touch-callout: none；原生殼內 body 不選取（.capacitor-native）。 |
| **捲動** | html/body overscroll-behavior；原生殼內 overscroll-behavior-y: contain。 |
| **字體** | 使用 system-ui、-apple-system。 |

### 5.2 可再加強（選用）

| 項目 | 說明 |
|------|------|
| **頁面切換動畫** | 使用 View Transitions API 或 React 路由過場，讓切頁更接近原生。 |
| **下拉更新** | 列表頁可加 pull-to-refresh（Capacitor 或自訂手勢）。 |
| **觸覺回饋** | 關鍵按鈕使用 Capacitor Haptics（專案已有 hapticLight 等）。 |
| **導航列／Tab 樣式** | 與系統導航列高度、模糊效果一致（可查 iOS 人機介面指南）。 |

---

## 六、iOS 建置與上架前檢查總表

| 類別 | 項目 | 完成打勾 |
|------|------|----------|
| **環境** | Node 18+、Xcode、CocoaPods 已安裝 | ☐ |
| **專案** | git pull origin ios、.env.local 與 secrets 已還原 | ☐ |
| **建置** | npm run build、npx cap sync ios、pod install、npm run ios 可跑起 | ☐ |
| **內購** | App Store Connect 四項消耗型產品已建、Shared Secret 已設、後端 receiptData/purchaseToken 對齊 | ☐ |
| **登入** | Sign in with Apple Capability、URL Scheme votechaos、Google/LINE 後台 iOS 設定 | ☐ |
| **廣告** | Info.plist GADApplicationIdentifier（測試或正式 ID） | ☐ |
| **強制更新** | system_config app_min_version、app_store_url_ios 已設（選填） | ☐ |
| **上架** | 憑證、Provisioning Profile、App Store Connect 資料與審核準備 | ☐ |

---

## 七、相關文件（專案內）

| 文件 | 用途 |
|------|------|
| **iOS建置-快速參考.md** | 一頁建置指令與狀態 |
| **iOS建置指南-完整版.md** | 完整 iOS 建置與除錯 |
| **內購申請流程詳細指南.md** / **In_App_Purchase_Application_Guide.md** | App Store 內購申請與設定 |
| **Apple_Server-to-Server_Notification_完整設定指南.md** | 伺服器端通知（若啟用） |
| **AdMob設定紀錄.md** | AdMob App ID／廣告單元 ID 與設定位置 |
| **強制更新功能說明.md** | app_min_version 與商店連結 |
| **USB轉移與Git連線步驟.md** | USB 轉移與 Mac 還原 |
| **功能與安全性檢查報告.md** | 功能與安全總覽 |

---

*建置 iOS 時可依本檔案從「二」到「六」依序檢查與實作；內購與登入若有問題可對照「三」「四」與上述相關文件。*
