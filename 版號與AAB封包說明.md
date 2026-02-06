# 版號與 AAB 封包說明

## 單一版號來源：`package.json`

- **版本欄位**：`package.json` 的 `"version": "1.0.38"` 為唯一來源。
- **個人頁下方**：顯示「ChaosRegistry v{版本}」，建置時由 Vite 從 `package.json` 注入。
- **Android AAB**：`android/app/build.gradle` 會讀取專案根目錄的 `package.json`，自動設定 `versionName` 與 `versionCode`（versionCode = patch，如 1.0.38 → 38）。

## 之後封包時如何更新版號

1. **只改一處**：編輯 `package.json`，將 `version` 改為新版本（例如 `1.0.39`）。
2. **建置與同步**：
   ```bash
   npm run build
   npx cap sync android
   ```
3. **產出 AAB**：在 Android Studio 選 **Build → Generate Signed Bundle / APK → Android App Bundle**，或指令：
   ```bash
   cd android && ./gradlew bundleRelease
   ```
   AAB 會產生在 `android/app/build/outputs/bundle/release/app-release.aab`。

個人頁與 AAB 版號會自動與 `package.json` 一致，無需再改 Android 或前端程式。

## 首頁版本號

- 程式碼中**首頁上方沒有**顯示版本號。
- 若曾在後台 UI 文案（例如 `home.header.title` 或 `home.header.subtitle`）中設定版號，請在 **後台 UI 文字管理** 改回「ChaosRegistry」／「不理性登記處」，即可移除首頁上的版號。

## 目前版本

- **package.json**：1.0.38  
- **個人頁**：ChaosRegistry v1.0.38  
- **Android**：versionName 1.0.38、versionCode 38（由 package.json 讀取）
