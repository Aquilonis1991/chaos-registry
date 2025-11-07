# 📱 如何建置修復版 APK（解決啟動崩潰問題）

---

## ❌ 問題診斷

**症狀**：APK 安裝後無法正常開啟

**根本原因**：
1. `main.tsx` 中 AdMob 初始化是阻塞式的
2. React App 在 Capacitor 初始化完成後才渲染
3. 如果 AdMob 初始化失敗，整個 APP 無法啟動
4. AndroidManifest.xml 缺少 AdMob APPLICATION_ID

---

## ✅ 已套用的修復

### 1. 修改 `src/main.tsx`
- ✅ React App 現在 **立即渲染**（不等待 Capacitor）
- ✅ Capacitor 初始化改為 **非阻塞式**
- ✅ 所有服務初始化錯誤都被 **catch 捕獲**

### 2. 修改 `src/lib/admob.ts`  
- ✅ AdMob 初始化更加 **容錯**
- ✅ 清空 `testingDevices` 陣列
- ✅ 失敗時返回 `false` 而不拋出錯誤

### 3. 修改 `android/app/src/main/AndroidManifest.xml`
- ✅ 添加 AdMob APPLICATION_ID meta-data
- ✅ 使用 Google 測試 ID

---

## 🔧 建置步驟

### 📝 **請在新的 PowerShell 視窗中執行以下步驟：**

#### 步驟 1: 開啟新的 PowerShell
- 按 `Win + X`，選擇「Windows PowerShell」
- 或在開始選單搜尋「PowerShell」

#### 步驟 2: 導航到專案目錄
```powershell
cd "C:\Users\USER\Documents\工作用\votechaos-main"
```

#### 步驟 3: 建置 Web 應用（包含修復）
```powershell
npm run build
```

**預期輸出**：
```
✓ built in X.XXs
```

#### 步驟 4: 同步到 Android
```powershell
npx cap sync android
```

**預期輸出**：
```
✓ Copying web assets...
✓ copy android in XXms
```

#### 步驟 5: 建置 APK

**選項 A：使用腳本（推薦）**
```powershell
.\BUILD-FIX-FINAL.ps1
```
當腳本提示時按 Enter 繼續。

**選項 B：手動執行**
```powershell
cd android
.\gradlew.bat clean assembleDebug
cd ..
```

#### 步驟 6: 複製 APK
```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" "VoteChaos-WORKING-$timestamp.apk"
```

---

## 📦 預期結果

**APK 檔案**：`VoteChaos-WORKING-YYYYMMDD-HHMMSS.apk`  
**大小**：約 7-8 MB  
**位置**：專案根目錄

---

## 📱 安裝測試

### 1. 卸載舊版本
在手機上卸載之前無法開啟的版本。

### 2. 安裝新版本
```powershell
adb install "VoteChaos-WORKING-YYYYMMDD-HHMMSS.apk"
```

或手動複製到手機安裝。

### 3. 測試清單

#### ✅ 基本啟動
- [ ] APP 圖示出現
- [ ] 點擊圖示 APP 開啟
- [ ] 顯示啟動畫面（Splash Screen）
- [ ] 進入首頁（不崩潰）

#### ✅ 核心功能
- [ ] 可以註冊/登入
- [ ] 可以瀏覽主題
- [ ] 可以投票
- [ ] 可以創建主題

#### ✅ AdMob（可選）
- [ ] 首頁有廣告佔位
- [ ] 廣告不會導致崩潰

---

## 🔍 如果仍然無法開啟

### 查看詳細日誌

```powershell
# 連接手機，啟用 USB 偵錯
adb logcat -c  # 清除舊日誌
adb logcat | Select-String "VoteChaos|Capacitor|AdMob|crash|FATAL"
```

然後嘗試啟動 APP，查看日誌中的錯誤訊息。

### 可能的問題

1. **手機 Android 版本太舊**
   - 需要 Android 7.0 (API 24) 或更高

2. **Google Play Services 未安裝**
   - AdMob 依賴 Google Play Services
   - 在中國大陸或某些手機可能沒有

3. **儲存空間不足**
   - 確保手機有足夠空間

### 提供除錯資訊

如果仍有問題，請提供：
- 手機型號
- Android 版本
- ADB logcat 錯誤訊息

---

## 📊 修復摘要

| 問題 | 修復 | 檔案 |
|------|------|------|
| APP 啟動崩潰 | React 立即渲染 | `src/main.tsx` |
| AdMob 阻塞 | 非阻塞初始化 | `src/main.tsx` |
| 初始化失敗 | Error catch | `src/lib/admob.ts` |
| 缺少 APP ID | 添加 meta-data | `AndroidManifest.xml` |

---

## 🎯 關鍵差異

### 之前（會崩潰）：
```typescript
// ❌ 錯誤：等待初始化完成才渲染
initializeCapacitor().then(() => {
  initializeAdMob().then(() => {
    // AdMob 失敗會卡在這裡
  });
});
createRoot(...).render(<App />);  // 永遠不會執行
```

### 現在（不會崩潰）：
```typescript
// ✅ 正確：立即渲染 UI
createRoot(...).render(<App />);

// 非阻塞初始化
initializeCapacitor()
  .then(() => {
    initializeAdMob().catch(err => {
      // 錯誤被捕獲，不影響 APP
    });
  });
```

---

## 🚀 快速指令總結

**在新的 PowerShell 視窗中依序執行：**

```powershell
# 1. 進入專案
cd "C:\Users\USER\Documents\工作用\votechaos-main"

# 2. 建置
npm run build

# 3. 同步
npx cap sync android

# 4. 建置 APK
cd android
.\gradlew.bat assembleDebug
cd ..

# 5. 複製 APK
Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" "VoteChaos-WORKING.apk"

# 6. 安裝
adb install VoteChaos-WORKING.apk
```

---

**完成以上步驟後，APP 應該可以正常啟動！** 🎉

