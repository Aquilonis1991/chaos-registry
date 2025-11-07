# 📱 如何建置 VoteChaos APK

---

## ⚠️ 當前狀況

您的環境中 **Node.js 尚未安裝**，因此無法直接建置 APK。

---

## ✅ 解決方案（2選1）

### 方案 A：安裝環境後建置（推薦）

#### 步驟 1: 安裝 Node.js

1. 訪問：https://nodejs.org/
2. 下載「LTS」版本（推薦版本 20.x）
3. 執行安裝程式
4. **重要**：勾選「Add to PATH」
5. 完成安裝
6. **重新開啟 PowerShell**

驗證安裝：
```powershell
node --version
npm --version
```

**時間**：5 分鐘

---

#### 步驟 2: 安裝 Android Studio

1. 訪問：https://developer.android.com/studio
2. 下載 Windows 版本
3. 執行安裝
4. 選擇「Standard」安裝類型
5. 等待下載 Android SDK

**時間**：30-60 分鐘（包含下載）

---

#### 步驟 3: 執行建置腳本

```powershell
# 在專案目錄執行
.\build-apk-en.ps1
```

**時間**：10-18 分鐘（首次）

---

#### 步驟 4: 安裝 APK

```powershell
# 連接 Android 手機，執行：
adb install VoteChaos-debug-YYYYMMDD-HHMMSS.apk
```

---

### 方案 B：使用線上建置服務（免本地環境）

#### 選項 1: GitHub Actions（免費）

1. 將代碼推送到 GitHub
2. 設置 GitHub Actions workflow
3. 自動建置並下載 APK

#### 選項 2: Capacitor Cloud（付費）

1. 註冊 Ionic Appflow
2. 連接專案
3. 雲端建置

#### 選項 3: 請其他開發者協助

1. 分享專案代碼
2. 請有環境的開發者建置
3. 取得 APK 檔案

---

## 📋 需要安裝的軟體清單

### 必須：
1. ✅ **Node.js** (v18+)
   - 下載：https://nodejs.org/
   - 用途：執行 npm 命令

2. ✅ **Android Studio**
   - 下載：https://developer.android.com/studio
   - 用途：建置 Android APK
   - 包含：Android SDK, Gradle, JDK

### 可選：
3. **Git**（如果要用 GitHub Actions）
   - 下載：https://git-scm.com/

---

## ⚡ 快速指令參考

### 環境已設置後：

```powershell
# 完整流程（一行命令）
npm install; npm run build; npx cap sync android; Push-Location android; .\gradlew.bat assembleDebug; Pop-Location; Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" "VoteChaos-debug.apk"

# 或使用腳本
.\build-apk-en.ps1
```

---

## 📁 APK 產出位置

建置成功後，APK 會在：

**原始位置**：
```
android\app\build\outputs\apk\debug\app-debug.apk
```

**複製到根目錄**：
```
VoteChaos-debug-YYYYMMDD-HHMMSS.apk
```

---

## 🎯 建置後測試

### 安裝到手機：

#### 方法 1: ADB（需要 USB）
```powershell
adb install VoteChaos-debug-YYYYMMDD-HHMMSS.apk
```

#### 方法 2: 手動安裝
1. 將 APK 複製到手機
2. 用檔案管理器開啟
3. 點擊安裝
4. 允許「未知來源」

---

### 測試清單：
- [ ] APP 啟動正常
- [ ] 可以註冊登入
- [ ] 可以瀏覽主題
- [ ] 可以投票
- [ ] AdMob 測試廣告顯示
- [ ] 所有功能正常

---

## 💡 提示

### 如果您想立即測試：

**選項 1**：使用 Web 版本
```powershell
# 需要先安裝 Node.js
npm install
npm run dev
# 訪問 http://localhost:5173
```

**選項 2**：請協助者建置
- 提供專案給有環境的開發者
- 取得建置好的 APK

---

## 📞 需要協助

### 相關文檔：
- **完整指南**：`BUILD_APK_GUIDE.md`
- **快速參考**：`BUILD_APK_QUICK.md`

### 腳本檔案：
- **英文版**（推薦）：`build-apk-en.ps1`
- **中文版**（有編碼問題）：`build-apk-simple.ps1`

---

## 🎊 總結

**當前狀態**：❌ Node.js 未安裝

**下一步**：
1. 安裝 Node.js（5分鐘）
2. 安裝 Android Studio（1小時）
3. 執行 `.\build-apk-en.ps1`（10-18分鐘）
4. 獲得測試 APK！

**或者**：使用線上建置服務（無需本地環境）

---

**安裝 Node.js 後，執行**：
```powershell
.\build-apk-en.ps1
```

就可以自動建置 APK 了！🚀


