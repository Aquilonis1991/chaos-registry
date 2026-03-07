# 打包新版本 AAB 並上傳至所有軌道

## 一、打包 AAB

1. **確認版號**：`package.json` 的 `version` 已更新（目前與 Android `versionCode` / `versionName` 同步）。
2. **執行建置**：
   ```bash
   npm run build:aab
   ```
3. **產出位置**：`android/app/build/outputs/bundle/release/app-release.aab`

（若需手動執行 Gradle：在專案根目錄執行後再到 `android` 目錄執行  
Windows：`cd android && gradlew.bat bundleRelease`  
Mac/Linux：`cd android && ./gradlew bundleRelease`）

---

## 二、上傳至 Google Play 並推到所有軌道

同一版 AAB 只需上傳一次，再依序「推廣」到各軌道即可。

1. **開啟 [Google Play Console](https://play.google.com/console)** → 選擇應用 → 左側「發布」。
2. **第一次上傳此版本**：
   - 建議先上傳到 **內部測試**（或 **封閉測試**）：
     - 進入「內部測試」→「建立新版本」→ 上傳 `app-release.aab` → 填寫版本說明 → 儲存並審查 → 開始推出。
   - 審查通過後再推廣到其他軌道。
3. **推廣到所有軌道**（同一 AAB 可重複使用）：
   - **內部測試** → 已上傳的版本 → 點「推廣版本」→ 選擇「封閉測試」→ 送審。
   - **封閉測試** 審查通過後 → 「推廣版本」→ 選擇「開放測試」→ 送審。
   - **開放測試** 審查通過後 → 「推廣版本」→ 選擇「正式版」→ 送審。
4. 若希望 **同一版本同時在內部／封閉／開放／正式** 都有：
   - 先在某一個軌道（例如內部測試）上傳並推出；
   - 再用「推廣版本」依序推到封閉 → 開放 → 正式，即可讓同一 AAB 出現在所有軌道。

---

## 三、包版後可選：強制更新門檻

若希望舊版 App 被要求更新，包版完成後可執行：

```bash
npm run sql:force-update
```

將輸出的 SQL 貼到 Supabase SQL Editor 執行，即可把 `app_min_version` 設為目前 `package.json` 的 version。
