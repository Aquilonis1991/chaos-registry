# Android 測試流程 - 完整指南

## 📋 測試前準備

### 步驟 1：停止所有相關進程
1. **關閉 Android Studio**（如果正在運行）
2. **關閉 Android 模擬器**（如果正在運行）
3. **關閉開發伺服器**（如果正在運行）

### 步驟 2：清理專案
在專案根目錄執行以下命令：

```powershell
# 清理 Android 構建緩存
cd android
.\gradlew clean
cd ..

# 清理 Node.js 緩存
Remove-Item -Recurse -Force node_modules/.vite -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# 清理 Capacitor 緩存
Remove-Item -Recurse -Force android/app/src/main/assets -ErrorAction SilentlyContinue
```

### 步驟 3：重新構建前端
```powershell
# 安裝依賴（如果需要）
npm install

# 構建前端（生產模式）
npm run build
```

### 步驟 4：同步 Capacitor
```powershell
# 同步 Web 資源到 Android
npx cap sync android
```

---

## 🏗️ 構建和安裝

### 步驟 5：完全重新構建 Android 應用程序
```powershell
cd android

# 完全清理
.\gradlew clean

# 重新構建並安裝
.\gradlew assembleDebug installDebug

cd ..
```

---

## 🧹 清理模擬器上的應用程序數據

### 步驟 6：卸載舊版本（如果存在）
```powershell
# 連接到模擬器
adb devices

# 卸載應用程序（兩種包名都要檢查）
adb uninstall com.votechaos.app
adb uninstall com.votechaos.app.debug

# 清除應用程序數據緩存（如果應用程序已安裝）
adb shell pm clear com.votechaos.app.debug
```

### 步驟 7：啟動模擬器
1. **打開 Android Studio**
2. **打開 AVD Manager**（Tools > Device Manager）
3. **啟動模擬器**（點擊播放按鈕）
4. **等待模擬器完全啟動**（看到主畫面）

---

## 📱 安裝應用程序

### 步驟 8：重新安裝應用程序
```powershell
cd android
.\gradlew installDebug
cd ..
```

---

## 🔍 查看日誌

### 步驟 9：清除舊日誌並開始監控
```powershell
# 清除 Logcat 緩衝區
adb logcat -c

# 開始監控日誌（實時輸出）
adb logcat -s VoteChaos:V JSConsole:V ReactNativeJS:V chromium:V SystemWebChromeClient:V
```

**或者使用 Android Studio 的 Logcat：**
1. 打開 Android Studio
2. 選擇模擬器設備
3. 在 Logcat 中設置過濾器：
   - Tag: `VoteChaos` 或 `JSConsole`
   - Package: `com.votechaos.app.debug`
   - Level: `Verbose`

---

## 🚀 啟動應用程序

### 步驟 10：啟動應用程序
在模擬器上：
1. **找到應用程序圖標**（ChaosRegistry 或 VoteChaos）
2. **點擊啟動**（不要從 Android Studio 啟動）
3. **觀察 Logcat 輸出**

### 步驟 11：檢查啟動日誌
您應該看到以下日誌（按順序）：

```
[D] VoteChaos: MainActivity onCreate start
[D] VoteChaos: MainActivity onCreate complete
[D] VoteChaos: MainActivity onStart
[D] VoteChaos: WebView page started loading: https://chaos-registry.vercel.app
[I] JSConsole: [vite] connecting...
[I] JSConsole: [vite] connected.
[I] JSConsole: Starting ChaosRegistry...
[I] JSConsole: React rendered
[D] VoteChaos: WebView page finished loading: https://chaos-registry.vercel.app
```

---

## 🔐 測試登入流程

### 步驟 12：測試 X (Twitter) 登入

#### 12.1 清除瀏覽器緩存
在模擬器中：
1. 打開 **設定** > **應用程序** > **Google Chrome**（或預設瀏覽器）
2. 點擊 **儲存空間** > **清除資料** > **清除所有資料**

#### 12.2 測試登入
1. **在應用程序中點擊「X (Twitter) 登入」按鈕**
2. **觀察 Logcat 輸出**，應該看到：
   ```
   [I] JSConsole: [AuthPage] X (Twitter) login button clicked
   [I] JSConsole: [AuthPage] Edge Function response received
   [I] JSConsole: [AuthPage] Auth URL: https://twitter.com/i/oauth2/authorize?...
   [D] VoteChaos: WebView shouldOverrideUrlLoading: https://twitter.com/i/oauth2/authorize?...
   ```
3. **瀏覽器應該打開**（外部瀏覽器或 WebView）
4. **完成 X (Twitter) 授權**
5. **觀察是否正確重定向回應用程序**

#### 12.3 檢查回調處理
在 Logcat 中應該看到：
```
[D] VoteChaos: Deep Link detected, triggering Intent: votechaos://auth/callback?...
[D] VoteChaos: Deep Link Intent started successfully
[I] JSConsole: [OAuthCallbackHandler] OAuth callback event received
[I] JSConsole: [OAuthCallbackHandler] Setting session...
[I] JSConsole: [OAuthCallbackHandler] Session set successfully
```

### 步驟 13：測試 LINE 登入

#### 13.1 測試登入
1. **在應用程序中點擊「LINE 登入」按鈕**
2. **觀察 Logcat 輸出**
3. **完成 LINE 授權**
4. **檢查是否正確重定向回應用程序**

---

## 🐛 常見問題排查

### 問題 1：應用程序卡在讀取畫面
**檢查：**
- Logcat 中是否有 JavaScript 錯誤
- WebView 是否成功加載頁面
- 是否有資源加載錯誤

**解決：**
```powershell
# 檢查是否有 JavaScript 錯誤
adb logcat | Select-String -Pattern "error|Error|ERROR" -Context 5,5

# 檢查 WebView 日誌
adb logcat -s VoteChaos:V chromium:V
```

### 問題 2：沒有 JavaScript 日誌
**檢查：**
- `WebChromeClient` 是否正確配置
- `debuggable` 是否啟用
- 應用程序是否以 debug 模式構建

**解決：**
```powershell
# 確認應用程序是 debug 版本
adb shell dumpsys package com.votechaos.app.debug | Select-String -Pattern "debuggable"

# 應該看到：debuggable=true
```

### 問題 3：登入後沒有重定向回應用程序
**檢查：**
- Deep Link 是否正確處理
- Intent Filter 是否正確配置
- `OAuthCallbackHandler` 是否正確監聽事件

**解決：**
```powershell
# 手動測試 Deep Link
adb shell am start -a android.intent.VIEW -d "votechaos://auth/callback#access_token=test&refresh_token=test"

# 應該看到應用程序打開並處理回調
```

### 問題 4：X (Twitter) 或 LINE 登入返回 401
**檢查：**
- Edge Function 環境變數是否正確設置
- Supabase 配置是否正確
- 網路連線是否正常

**解決：**
```powershell
# 檢查 Edge Function 日誌（在 Supabase Dashboard）
# Dashboard > Edge Functions > twitter-auth > Logs
# Dashboard > Edge Functions > line-auth > Logs
```

---

## ✅ 驗證清單

完成測試後，確認以下項目：

- [ ] 應用程序正常啟動，沒有卡在讀取畫面
- [ ] JavaScript 日誌正常輸出到 Logcat（`JSConsole` 標籤）
- [ ] WebView 頁面加載日誌正常（`VoteChaos` 標籤）
- [ ] X (Twitter) 登入流程完整：
  - [ ] 點擊按鈕後打開授權頁面
  - [ ] 完成授權後重定向回應用程序
  - [ ] 成功登入並跳轉到首頁
- [ ] LINE 登入流程完整：
  - [ ] 點擊按鈕後打開授權頁面
  - [ ] 完成授權後重定向回應用程序
  - [ ] 成功登入並跳轉到首頁
- [ ] 沒有錯誤或異常日誌
- [ ] 資源加載錯誤已記錄（如果有）

---

## 📝 記錄測試結果

測試完成後，請記錄：

1. **測試時間**：____________
2. **測試環境**：
   - 模擬器型號：____________
   - Android 版本：____________
   - 應用程序版本：____________
3. **測試結果**：
   - 應用程序啟動：✅ / ❌
   - JavaScript 日誌：✅ / ❌
   - X (Twitter) 登入：✅ / ❌
   - LINE 登入：✅ / ❌
4. **遇到的問題**：____________
5. **Logcat 輸出片段**（如有錯誤）：____________

---

## 🔄 快速重新測試（如果遇到問題）

如果測試失敗，執行以下快速清理流程：

```powershell
# 1. 停止應用程序
adb shell am force-stop com.votechaos.app.debug

# 2. 清除應用程序數據
adb shell pm clear com.votechaos.app.debug

# 3. 清除 Logcat
adb logcat -c

# 4. 重新啟動應用程序
adb shell am start -n com.votechaos.app.debug/.MainActivity

# 5. 監控日誌
adb logcat -s VoteChaos:V JSConsole:V
```
