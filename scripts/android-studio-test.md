# 在 Android Studio 中測試修改

## 第一次或要完整重建

1. 在專案根目錄執行：
   ```bash
   npm run android
   ```
   - 會先建置網頁（`npm run build`）、同步到 Android 專案（`cap sync android`），再開啟 Android Studio。

2. 在 Android Studio 中：
   - 選一台模擬器或接上實機。
   - 按 **Run**（綠色三角形）執行 App。

## 修改程式後要重測

1. 改完網頁/TS/React 後，在專案根目錄執行：
   ```bash
   npm run android:sync
   ```
   或：
   ```bash
   npm run cap:sync:android
   ```
   - 會重新建置並把最新 `dist` 同步到 `android/app/src/main/assets/public`。

2. 回到 **Android Studio**，再按一次 **Run**，即可在模擬器/實機上看到最新修改。

## 注意

- 一定要先執行 `android:sync`（或 `android`）再在 Android Studio 按 Run，否則會跑舊的網頁內容。
- 若只改了 Java/Kotlin 或 Android 資源，不用跑 sync，直接在 Android Studio 按 Run 即可。
