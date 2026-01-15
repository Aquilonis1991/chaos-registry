# Android APP 重新編譯並安裝步驟

## 前置準備

1. **確保已安裝 Node.js 和 npm**
   - 打開終端（Terminal）或 PowerShell
   - 運行 `node --version` 和 `npm --version` 確認已安裝

2. **確保已安裝 Android Studio**
   - Android Studio 已安裝並配置好 Android SDK
   - Android 模擬器已創建或已連接實體設備

## 步驟 1：重新構建前端代碼

### 在專案根目錄（votechaos-main）打開終端

```bash
# 1. 進入專案目錄
cd C:\Users\USER\Documents\Mywork\votechaos-main

# 2. 安裝依賴（如果需要）
npm install

# 3. 重新構建前端代碼
npm run build
```

**等待構建完成**（會顯示 `dist/` 目錄已更新）

## 步驟 2：同步 Capacitor 到 Android

### 在同一個終端中執行

```bash
# 同步前端代碼到 Android 專案
npx cap sync android
```

**等待同步完成**

## 步驟 3：在 Android Studio 中打開專案

1. **打開 Android Studio**

2. **打開專案**
   - 點擊 `File` → `Open...`
   - 或者如果之前打開過，點擊 `File` → `Open Recent` → 選擇專案

3. **選擇 Android 專案目錄**
   - 導航到 `C:\Users\USER\Documents\Mywork\votechaos-main\android`
   - 選擇 `android` 資料夾
   - 點擊 `OK`

4. **等待 Gradle 同步完成**
   - 底部的狀態欄會顯示 "Gradle sync in progress..."
   - 等待同步完成（可能需要幾分鐘）

## 步驟 4：選擇運行目標

### 方式 A：使用模擬器

1. **啟動模擬器**
   - 點擊 Android Studio 頂部工具列的裝置選擇下拉選單（通常顯示 "No devices" 或現有設備）
   - 點擊 `Device Manager`（或從 `Tools` → `Device Manager`）
   - 找到您要使用的模擬器
   - 點擊模擬器右側的 ▶️（播放）按鈕啟動模擬器
   - 等待模擬器完全啟動（顯示 Android 桌面）

2. **選擇模擬器**
   - 回到 Android Studio 主視窗
   - 點擊頂部工具列的裝置選擇下拉選單
   - 現在應該會顯示您的模擬器（例如 "Pixel 7 API 34"）
   - 選擇該模擬器

### 方式 B：使用實體設備

1. **連接設備**
   - 使用 USB 線連接 Android 手機到電腦
   - 在手機上啟用「USB 偵錯」（開發者選項）

2. **選擇設備**
   - 點擊頂部工具列的裝置選擇下拉選單
   - 選擇您的手機設備

## 步驟 5：構建並安裝 APP

### 方法 1：使用「Run」按鈕（推薦）

1. **找到頂部工具列**
   - 在 Android Studio 頂部工具列中
   - 找到綠色三角形 ▶️ 圖示（通常標示為 "Run 'app'" 或 "Run"）

2. **點擊 Run 按鈕**
   - 點擊綠色 ▶️ 按鈕
   - 或者使用快捷鍵 `Shift + F10`

3. **等待構建和安裝**
   - 底部的 `Build` 標籤會顯示構建進度
   - 構建完成後，`Run` 標籤會顯示安裝和啟動進度
   - APP 會自動安裝並啟動在模擬器或設備上

### 方法 2：使用選單

1. **打開 Run 選單**
   - 點擊頂部選單 `Run`
   - 選擇 `Run 'app'`

2. **等待構建和安裝**
   - 同方法 1 的步驟 3

### 方法 3：使用 Gradle 任務（進階）

1. **打開 Gradle 面板**
   - 在 Android Studio 右側找到 `Gradle` 標籤
   - 如果沒有看到，點擊 `View` → `Tool Windows` → `Gradle`

2. **展開任務**
   - 展開 `votechaos-main > Tasks > install`
   - 找到 `installDebug` 任務

3. **執行任務**
   - 雙擊 `installDebug` 任務
   - 或右鍵點擊 → `Run 'installDebug'`

4. **等待安裝完成**
   - 底部的 `Build` 標籤會顯示進度
   - 完成後，APP 會安裝在設備上，但不會自動啟動

## 步驟 6：驗證安裝

1. **檢查 Logcat**
   - 在 Android Studio 底部找到 `Logcat` 標籤
   - 確保選擇了正確的設備和應用（`com.votechaos.app.debug`）
   - 查看是否有錯誤訊息

2. **檢查 APP**
   - 在模擬器或設備上，找到並啟動 `ChaosRegistry` APP
   - 測試 X (Twitter) 登入功能

## 故障排除

### 問題 1：找不到 Run 按鈕

- **解決方案**：確保已經正確打開了 Android 專案（`android` 資料夾），而不是整個 `votechaos-main` 專案

### 問題 2：Gradle 同步失敗

- **解決方案**：
  1. 點擊 `File` → `Invalidate Caches...`
  2. 選擇 `Invalidate and Restart`
  3. 等待 Android Studio 重啟並重新同步

### 問題 3：構建失敗

- **解決方案**：
  1. 檢查 `Build` 標籤中的錯誤訊息
  2. 確保已正確執行 `npm run build` 和 `npx cap sync android`
  3. 嘗試 `Build` → `Clean Project`，然後重新構建

### 問題 4：找不到設備

- **解決方案**：
  1. 確保模擬器已完全啟動
  2. 或確保實體設備已連接並啟用 USB 偵錯
  3. 點擊 `Tools` → `Device Manager` 檢查設備狀態

## 快速命令（全部在終端執行）

如果您熟悉命令行，可以使用以下命令快速完成：

```bash
# 1. 進入專案目錄
cd C:\Users\USER\Documents\Mywork\votechaos-main

# 2. 重新構建前端
npm run build

# 3. 同步到 Android
npx cap sync android

# 4. 在 Android Studio 中構建並安裝
# 或使用命令行：
cd android
.\gradlew assembleDebug
.\gradlew installDebug
```

## 注意事項

- 每次修改前端代碼後，都需要執行 `npm run build` 和 `npx cap sync android`
- 如果只修改了 Android 原生代碼（如 MainActivity.java），只需要在 Android Studio 中重新構建即可
- 如果修改了 `capacitor.config.ts`，需要執行 `npx cap sync android`
