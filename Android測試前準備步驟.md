# 📱 Android Studio 測試前準備步驟

## ⚠️ 重要說明

我們修改的是 **React 前端代碼**（組件、Hooks），這些變更需要：
- ✅ 重新建置 React 應用
- ✅ 同步到 Android 專案  
- ✅ 在 Android Studio 中重新建置 APK

**不需要修改原生 Android 代碼**，所以只需要同步即可。

---

## 🚀 方法一：一鍵命令（推薦）

在專案根目錄執行：

```powershell
npm run android
```

**這個命令會自動：**
1. 建置 React 應用 (`npm run build`)
2. 同步到 Android 專案 (`npx cap sync android`)
3. 打開 Android Studio (`npx cap open android`)

**預計時間**：2-5 分鐘

---

## 📋 方法二：分步執行（詳細版）

### 步驟 1: 建置 React 應用

```powershell
# 在專案根目錄執行
npm run build
```

**預期結果**：
- 生成 `dist/` 資料夾
- 包含所有編譯後的 HTML、CSS、JavaScript

**預計時間**：1-2 分鐘

---

### 步驟 2: 同步到 Android 專案

```powershell
npx cap sync android
```

**這個命令會：**
- 將 `dist/` 中的檔案複製到 `android/app/src/main/assets/public/`
- 更新 Android 專案的依賴和配置
- 同步 Capacitor 插件

**預期結果**：
- 看到同步成功的訊息
- `android/` 資料夾中的檔案已更新

**預計時間**：30 秒 - 1 分鐘

---

### 步驟 3: 打開 Android Studio

```powershell
npx cap open android
```

**或者手動：**
- 打開 Android Studio
- 選擇 `File` → `Open`
- 選擇專案中的 `android/` 資料夾

---

### 步驟 4: 在 Android Studio 中建置

#### 選項 A: 圖形界面（推薦）

1. 等待 Android Studio 索引完成（首次 1-5 分鐘）
2. 頂部選單：`Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
3. 等待建置完成（首次 5-10 分鐘，後續 1-3 分鐘）
4. 點擊通知中的「locate」查看 APK 位置

#### 選項 B: Gradle 命令

在 Android Studio 的 Terminal 中執行：

```bash
cd android
.\gradlew assembleDebug
```

APK 位置：`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔍 驗證同步是否成功

### 檢查點 1: 確認 dist 資料夾存在

```powershell
# 檢查 dist 資料夾
ls dist
```

應該看到：
- `index.html`
- `assets/` 資料夾（包含 JS、CSS 檔案）

---

### 檢查點 2: 確認 Android assets 已更新

```powershell
# 檢查 Android assets
ls android/app/src/main/assets/public
```

應該看到：
- `index.html`
- `assets/` 資料夾

---

### 檢查點 3: 檢查檔案時間戳

確認 `android/app/src/main/assets/public/index.html` 的修改時間是最新的。

---

## 🎯 測試新功能

同步完成後，在 Android Studio 中：

1. **連接設備或啟動模擬器**
   - 連接 USB 設備，或
   - 啟動 Android 模擬器

2. **運行應用**
   - 點擊 `Run` 按鈕（綠色播放圖示）
   - 或按 `Shift + F10`

3. **測試功能**
   - 測試無限滾動：進入首頁，滾動到底部
   - 測試時間篩選：進入歷史記錄頁面，點擊右上角篩選按鈕

---

## ⚡ 快速同步（已打開 Android Studio）

如果 Android Studio 已經打開，只需要：

1. **在終端機執行同步**：
```powershell
npm run build
npx cap sync android
```

2. **在 Android Studio 中刷新**：
   - 點擊 `File` → `Sync Project with Gradle Files`
   - 或等待自動同步完成

3. **重新運行應用**：
   - 點擊 `Run` 按鈕

---

## 🔄 開發時的快速循環

如果經常修改前端代碼，建議使用：

### 熱重載開發模式（Web）

```powershell
npm run dev
```

在瀏覽器中測試（`http://localhost:5173`），確認功能正常後再同步到 Android。

### 快速同步腳本

創建 `sync-android.ps1`：

```powershell
Write-Host "建置 React 應用..." -ForegroundColor Yellow
npm run build

Write-Host "同步到 Android..." -ForegroundColor Yellow
npx cap sync android

Write-Host "✅ 同步完成！" -ForegroundColor Green
Write-Host "請在 Android Studio 中重新運行應用" -ForegroundColor Cyan
```

使用：
```powershell
.\sync-android.ps1
```

---

## ❓ 常見問題

### Q: 每次修改都需要重新建置嗎？

**A: 是的！** 因為我們修改的是 React 代碼，需要：
- 重新建置（`npm run build`）
- 同步到 Android（`npx cap sync android`）
- 在 Android Studio 中重新運行

### Q: 可以只在 Android Studio 中建置嗎？

**A: 不行！** 必須先建置 React 應用，因為：
- Android 專案使用的是編譯後的 `dist/` 檔案
- 直接建置 Android 會使用舊版本的代碼

### Q: 同步後還需要重新建置 APK 嗎？

**A: 看情況：**
- **運行到設備/模擬器**：不需要，直接 `Run` 即可
- **產出 APK 檔案**：需要重新建置 APK

### Q: 修改原生代碼需要重新同步嗎？

**A: 不需要！** 如果只修改 `android/` 資料夾中的 Java/Kotlin 代碼：
- 不需要執行 `cap sync`
- 直接在 Android Studio 中建置即可

---

## 📝 完整流程檢查清單

- [ ] 執行 `npm run build`（建置 React 應用）
- [ ] 執行 `npx cap sync android`（同步到 Android）
- [ ] 確認 `dist/` 資料夾已生成
- [ ] 確認 `android/app/src/main/assets/public` 已更新
- [ ] 打開 Android Studio
- [ ] 連接設備或啟動模擬器
- [ ] 點擊 `Run` 運行應用
- [ ] 測試無限滾動功能
- [ ] 測試時間篩選功能

---

## 🎉 完成！

現在您可以在 Android Studio 中測試新功能了！

**提示**：如果功能不正常，請檢查：
1. 是否成功同步（查看 `android/app/src/main/assets/public`）
2. 是否重新運行了應用
3. 瀏覽器 Console 是否有錯誤（在 Android Studio 的 Logcat 中查看）
