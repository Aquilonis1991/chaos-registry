# Android 快速測試流程（您需要執行的步驟）

## ✅ 已自動完成（不需要您執行）
- ✅ 清理並重新構建 Android 應用程序
- ✅ 安裝到模擬器

---

## 📱 您需要執行的步驟

### 步驟 0：創建 Android 模擬器（如果模擬器被刪除）

1. **打開 Android Studio**
2. **打開 Device Manager**：
   - 點擊頂部工具欄的 **Tools** > **Device Manager**
   - 或者點擊右側工具欄的 **Device Manager** 圖標
3. **創建模擬器**：
   - 點擊 **Create Device** 按鈕（+ 圖標）
   - 選擇 **Phone** 類別
   - 選擇一個設備（例如：**Pixel 5** 或 **Pixel 6**）
   - 點擊 **Next**
4. **選擇系統映像（System Image）**：
   - 選擇一個 API 級別（建議：**API 33** 或 **API 34**）
   - 如果還沒下載，點擊 **Download** 下載
   - 下載完成後，點擊 **Next**
5. **配置 AVD（Android Virtual Device）**：
   - **AVD Name**：可以保持預設名稱或自訂（例如：`Test_Device`）
   - **Startup orientation**：選擇 **Portrait**（直向）
   - 點擊 **Finish**
6. **啟動模擬器**：
   - 在 Device Manager 中找到剛創建的模擬器
   - 點擊右側的 **播放按鈕**（▶）啟動
   - 等待模擬器完全啟動（看到主畫面）

### 步驟 1：使用 Android Studio 的 Logcat（推薦）

1. **確認模擬器已啟動**（在 Device Manager 中看到運行狀態）
2. **選擇模擬器設備**（在頂部工具欄的設備選擇器中選擇剛啟動的模擬器）
3. **打開 Logcat 視圖**（底部面板的 "Logcat" 標籤）
4. **設置過濾器**：
   - 在 Logcat 搜索框輸入：`VoteChaos JSConsole`
   - 或者點擊右上角的過濾器圖標，在 "Tag" 欄位輸入：`VoteChaos|JSConsole`
5. **清除舊日誌**：點擊 Logcat 工具欄中的清除按鈕（垃圾桶圖標）

**方法 B：使用 Android Studio 的 Terminal（如果 PATH 已配置）**

如果 Android Studio 的 Terminal 可以識別 `adb` 命令，則執行：
```powershell
adb uninstall com.votechaos.app.debug
adb logcat -c
adb logcat -s VoteChaos:* JSConsole:*
```

**方法 C：找到 adb 的完整路徑**

如果以上方法都不行，需要找到 `adb.exe` 的完整路徑：
```powershell
# 通常位於以下位置之一：
# C:\Users\USER\AppData\Local\Android\Sdk\platform-tools\adb.exe
# 或
# C:\Program Files\Android\android-sdk\platform-tools\adb.exe

# 使用完整路徑執行
& "C:\Users\USER\AppData\Local\Android\Sdk\platform-tools\adb.exe" uninstall com.votechaos.app.debug
& "C:\Users\USER\AppData\Local\Android\Sdk\platform-tools\adb.exe" logcat -c
& "C:\Users\USER\AppData\Local\Android\Sdk\platform-tools\adb.exe" logcat -s VoteChaos:* JSConsole:*
```

### 步驟 2：在模擬器上啟動應用程序
1. **確認模擬器已啟動**（如果還沒啟動，先啟動模擬器）
2. **找到應用程序圖標**（ChaosRegistry 或 VoteChaos）
3. **點擊圖標啟動應用程序**
   - ⚠️ **重要：不要從 Android Studio 的 Run 按鈕啟動**
   - ⚠️ **必須從模擬器直接點擊圖標啟動**

### 步驟 3：觀察應用程序行為
啟動後，請檢查：
- [ ] 應用程序是否正常啟動（沒有卡在讀取畫面）
- [ ] 是否能進入登入頁面
- [ ] 是否看到 JavaScript 日誌（`JSConsole: Starting ChaosRegistry...`）
- [ ] 是否有任何錯誤訊息

### 步驟 4：測試登入功能（可選）
1. **點擊「X (Twitter) 登入」按鈕**
2. **觀察 Logcat 輸出**，應該看到：
   - `[AuthPage] X (Twitter) login button clicked`
   - `[AuthPage] Auth URL: https://twitter.com/...`
3. **觀察是否打開授權頁面**
4. **完成授權後，觀察是否正確返回應用程序**

---

## ✅ 預期結果

### 正常情況，應該看到：

**在 Logcat 中：**
```
[D] VoteChaos: MainActivity onCreate start
[D] VoteChaos: WebView page started loading: https://...
[I] JSConsole: Starting ChaosRegistry...
[I] JSConsole: React rendered
[D] VoteChaos: WebView page finished loading: https://...
```

**在應用程序中：**
- ✅ 應用程序正常啟動，顯示登入頁面
- ✅ 點擊登入按鈕後，正確打開授權頁面
- ✅ 完成授權後，成功返回應用程序並登入

### 如果有問題，請提供：
1. **應用程序卡在哪個畫面？**（讀取畫面 / 登入頁面 / 其他）
2. **是否有看到 JavaScript 日誌？**（`JSConsole` 標籤的輸出）
3. **點擊登入按鈕後發生了什麼？**（沒有反應 / 打開錯誤頁面 / 其他）
4. **Logcat 中的錯誤訊息**（如果有）

---

## 🔄 如果需要重新測試

如果測試失敗，在 Android Studio 的 Terminal 執行：

```powershell
# 停止應用程序
adb shell am force-stop com.votechaos.app.debug

# 清除應用程序數據
adb shell pm clear com.votechaos.app.debug

# 清除日誌
adb logcat -c
```

然後重新執行步驟 1-4。
