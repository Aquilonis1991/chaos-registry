# Android 模擬器版本檢查指南

## 📋 當前配置

根據 `android/variables.gradle`：
- **compileSdkVersion**: 34
- **targetSdkVersion**: 33
- **minSdkVersion**: 24

## ✅ 建議的模擬器配置

### 1. API 級別選擇
**推薦使用 API 33（Android 13）**，因為：
- `targetSdkVersion = 33`
- 與應用程式目標 SDK 版本一致，避免兼容性問題

### 2. 檢查當前模擬器版本
在 Android Studio 中：
1. 打開 **Device Manager**（工具欄 > Device Manager 圖標）
2. 選擇您的模擬器
3. 查看 **API Level** 欄位

### 3. 創建新的 API 33 模擬器（如果需要）

#### 步驟：
1. **Device Manager** > **Create Device**
2. **選擇設備**：
   - 推薦：**Pixel 5** 或 **Pixel 6**
   - 或任何您偏好的設備
3. **選擇系統映像**：
   - **API Level**: **33 (Android 13)**
   - **ABI**: **x86_64**（推薦，性能更好）或 **arm64-v8a**
   - **Release Name**: **Tiramisu** 或 **13**
4. **Finish** 完成創建

### 4. 更新 Android WebView
在模擬器中：
1. 打開 **Play Store**
2. 搜尋 **"Android System WebView"**
3. 更新至最新版本

或通過命令列：
```bash
adb install -r -d "path/to/webview.apk"
```

## 🔍 故障排除

### 問題 1：模擬器無法啟動
**解決方案**：
- 確保 **HAXM**（Intel）或 **Hypervisor**（AMD）已啟用
- 檢查 BIOS 中的虛擬化設定
- 嘗試使用 **x86_64** 而非 **arm64-v8a** 映像

### 問題 2：WebView 版本過舊
**檢查方法**：
在 Logcat 中搜尋：
```
WebViewFactory          I  Loading com.google.android.webview version
```

**應該看到**：
```
WebViewFactory          I  Loading com.google.android.webview version 134.0.6998.135
```

如果版本過舊（< 100），請更新 WebView。

### 問題 3：API 33 模擬器不可用
**替代方案**：
- 使用 **API 31 (Android 12)** 或 **API 32 (Android 12L)**
- 這些版本也與 `targetSdkVersion = 33` 兼容

## 📱 真實設備測試（推薦）

如果模擬器問題持續，建議在真實設備上測試：
1. 啟用 **開發者選項**
2. 啟用 **USB 調試**
3. 連接設備到電腦
4. 在 Android Studio 中選擇設備運行

真實設備通常比模擬器更穩定，且能反映真實用戶體驗。

## ⚠️ 重要提醒

**我已經修復了 `MainActivity.java` 中的 `shouldInterceptRequest` 委託問題**，這是導致 `ERR_CONNECTION_REFUSED` 的**根本原因**。

建議：
1. **先測試修復後的版本**（已重新編譯安裝）
2. 如果問題仍然存在，**再考慮模擬器版本問題**
3. 最終建議：**在真實設備上測試**
