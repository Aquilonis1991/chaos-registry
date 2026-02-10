# Mac 移轉前準備清單

出發到 Mac 前，請依序勾選以下項目。

---

## 一、程式碼（已就緒）

- [x] 所有變更已提交並推送到 **origin**
- [x] 遠端分支已同步：**android**、**main**、**ios**
- [ ] 記下 Git 遠端網址（到 Mac 要 clone 用）：  
  **https://github.com/Aquilonis1991/chaos-registry.git**

---

## 二、必須「手動帶去 Mac」的內容（不會在 Git 裡）

這些檔案**不會**透過 Git 同步，請用 USB、雲端或複製貼上帶到 Mac。

### 1. 環境變數 `.env.local`

- **在 Windows 位置**：`votechaos-main\.env.local`（專案根目錄）
- **到 Mac 後**：在專案根目錄新建檔案 `.env.local`，內容與 Windows 相同

**若你沒有 .env.local**：到 Mac 後可依 `env.example.txt` 建立，並填入：

| 變數 | 說明 |
|------|------|
| `VITE_SUPABASE_URL` | Supabase 專案網址 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_PUBLIC_SITE_URL` | 網站網址（如 chaos-registry.vercel.app） |
| `VITE_APP_DEEP_LINK` | votechaos://auth/verify |
| `VITE_APP_DOWNLOAD_URL` | 下載頁網址 |

- [ ] 我已將 `.env.local` 內容備份（複製到記事本 / 雲端 / USB）

### 2. 密鑰資料夾 `secrets/`（若有使用）

- **在 Windows 位置**：`votechaos-main\secrets\`
- **到 Mac 後**：在專案根目錄建立 `secrets/`，把相同檔案放進去

常見檔案：`apple-sign-in-key.p8`、`apple-jwt-token.txt` 等。

- [ ] 我不使用 secrets，跳過  
- [ ] 我已將 `secrets` 資料夾複製到 USB / 雲端

---

## 三、不需要帶的（到 Mac 再產生即可）

- **node_modules**：到 Mac 後執行 `npm install`
- **dist**：到 Mac 後執行 `npm run build`
- **android/app/build**、**ios/App/Pods**：到 Mac 後建置時會自動產生
- **AAB / APK**：上傳商店用，不需帶去 Mac 做 iOS 建置

---

## 四、出發前最後確認

- [ ] Git 已推送（android / main / ios）
- [ ] `.env.local` 已備份或已記下要填的變數
- [ ] 若有 `secrets/`，已複製到可攜帶的媒介
- [ ] 已閱讀 `Windows移轉Mac_打包與設定指南.md`（到 Mac 後的步驟）

---

## 五、到 Mac 後第一件事（簡要）

1. 安裝：Node.js 18+、Xcode、CocoaPods（`brew install cocoapods` 或 `sudo gem install cocoapods`）
2. Clone：`git clone https://github.com/Aquilonis1991/chaos-registry.git votechaos-main && cd votechaos-main`
3. 若要做 iOS：`git checkout ios`（或維持 main）
4. 還原設定：建立 `.env.local`、還原 `secrets/`
5. 建置：`npm install` → `npm run build` → `npx cap sync ios` → `cd ios/App && pod install` → `npm run ios`

詳細步驟見 **Windows移轉Mac_打包與設定指南.md**。
