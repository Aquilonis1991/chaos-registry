# 📱 建置測試 APK 完整指南

> **目標**: 產出可安裝的測試 APK 檔案  
> **平台**: Android  
> **環境**: Windows

---

## ✅ 前置需求檢查清單

### 必須安裝的軟體：

- [ ] **Node.js** (v18 或更高)
  - 下載：https://nodejs.org/
  - 驗證：`node --version`

- [ ] **Android Studio**
  - 下載：https://developer.android.com/studio
  - 包含 Android SDK、Gradle

- [ ] **Java Development Kit (JDK)**
  - 建議：JDK 17
  - Android Studio 通常會自動安裝

---

## 🚀 建置步驟（詳細版）

### 步驟 1: 安裝依賴

```powershell
# 在專案根目錄執行
cd "C:\Users\USER\Documents\工作用\votechaos-main"

# 安裝 Node.js 依賴
npm install

# 預計時間: 2-5 分鐘
```

---

### 步驟 2: 建置 Web 應用

```powershell
# 建置 React 應用到 dist 資料夾
npm run build

# 預計時間: 1-2 分鐘
```

---

### 步驟 3: 初始化 Capacitor Android（首次）

```powershell
# 如果還沒添加 Android 平台
npx cap add android

# 預計時間: 1 分鐘
```

---

### 步驟 4: 同步代碼到 Android

```powershell
# 將 Web 應用同步到 Android 專案
npx cap sync android

# 預計時間: 30 秒
```

---

### 步驟 5: 配置 Android

#### 5.1 添加 AdMob App ID

**檔案**: `android/app/src/main/AndroidManifest.xml`

在 `<application>` 標籤內添加：

```xml
<!-- AdMob App ID（測試用）-->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713"/>
```

參考檔案：`android-config/AndroidManifest-admob.xml`

#### 5.2 檢查網路權限

確認 `AndroidManifest.xml` 包含：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

---

### 步驟 6: 打開 Android Studio

```powershell
# 打開 Android 專案
npx cap open android

# 這會啟動 Android Studio
```

---

### 步驟 7: 在 Android Studio 建置 APK

#### 方法 A: 建置測試 APK（推薦）

1. **在 Android Studio 中**:
   - 頂部選單：`Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`

2. **等待建置**:
   - 第一次建置需要 5-10 分鐘
   - 下載 Gradle 依賴
   - 編譯代碼

3. **建置完成後**:
   - 右下角會顯示「APK(s) generated successfully」
   - 點擊「locate」查看 APK 位置

4. **APK 位置**:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

#### 方法 B: 使用 Gradle 命令（終端機）

在 Android Studio 的 Terminal 中執行：

```bash
# Windows
cd android
.\gradlew assembleDebug

# APK 位置相同
```

---

### 步驟 8: 安裝測試 APK

#### 方法 1: 實體手機（推薦）

1. **啟用開發者模式**:
   - 設定 → 關於手機 → 連續點擊「版本號」7次
   - 設定 → 開發者選項 → 啟用「USB 偵錯」

2. **連接手機**:
   - USB 線連接電腦和手機
   - 允許 USB 偵錯

3. **安裝 APK**:
   ```powershell
   # 使用 ADB
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

   或

   - 將 APK 複製到手機
   - 用檔案管理器打開並安裝

---

#### 方法 2: Android 模擬器

1. **在 Android Studio 中**:
   - 頂部工具列：點擊 Device Manager
   - 創建虛擬設備（推薦 Pixel 5, API 33）

2. **運行模擬器**:
   - 點擊播放按鈕啟動模擬器

3. **安裝 APK**:
   - 將 APK 拖放到模擬器視窗
   - 或使用 adb install

---

## 🎯 快速建置腳本

創建 `build-apk.ps1`：

```powershell
# 自動建置 APK 腳本
Write-Host "開始建置 VoteChaos APK..." -ForegroundColor Green

# 1. 安裝依賴
Write-Host "`n[1/5] 安裝依賴..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 2. 建置 Web 應用
Write-Host "`n[2/5] 建置 Web 應用..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 3. 同步到 Android
Write-Host "`n[3/5] 同步到 Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 4. 建置 APK
Write-Host "`n[4/5] 建置 APK（需要 Android Studio）..." -ForegroundColor Yellow
Set-Location android
.\gradlew assembleDebug
if ($LASTEXITCODE -ne 0) { 
    Set-Location ..
    exit $LASTEXITCODE 
}
Set-Location ..

# 5. 完成
Write-Host "`n[5/5] 建置完成！" -ForegroundColor Green
Write-Host "`nAPK 位置:" -ForegroundColor Cyan
Write-Host "android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor White

# 複製到根目錄（方便找到）
Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" "VoteChaos-debug.apk"
Write-Host "`n已複製到根目錄: VoteChaos-debug.apk" -ForegroundColor Green

Write-Host "`n安裝方式:" -ForegroundColor Cyan
Write-Host "adb install VoteChaos-debug.apk" -ForegroundColor White
```

**使用方式**:
```powershell
.\build-apk.ps1
```

---

## ⚡ 一鍵建置（如果環境已設置）

```powershell
# 完整流程
npm install && npm run build && npx cap sync android && cd android && .\gradlew assembleDebug && cd .. && copy android\app\build\outputs\apk\debug\app-debug.apk VoteChaos-debug.apk

# 或分步執行
npm install                    # 安裝依賴
npm run build                  # 建置
npx cap sync android           # 同步
cd android                     # 進入 android 目錄
.\gradlew assembleDebug        # 建置 APK
cd ..                          # 返回根目錄
```

---

## 🐛 常見問題

### Q1: npm 命令找不到？

**原因**: Node.js 未安裝或未加入 PATH

**解決**:
1. 下載並安裝 Node.js: https://nodejs.org/
2. 重啟終端機
3. 驗證：`node --version`

---

### Q2: gradlew 找不到？

**原因**: 尚未添加 Android 平台

**解決**:
```powershell
npx cap add android
```

---

### Q3: Android Studio 找不到 SDK？

**原因**: Android SDK 未安裝

**解決**:
1. 打開 Android Studio
2. Tools → SDK Manager
3. 安裝 Android SDK（至少 API 33）
4. 設定 ANDROID_HOME 環境變數

---

### Q4: 建置失敗，缺少 JDK？

**原因**: Java JDK 未安裝

**解決**:
1. Android Studio → File → Project Structure
2. SDK Location → JDK Location
3. 下載 JDK 17: https://adoptium.net/

---

### Q5: 權限錯誤？

**原因**: gradlew 沒有執行權限

**解決**:
```powershell
cd android
chmod +x gradlew    # Mac/Linux
# Windows 通常不需要
```

---

## 📦 APK 類型說明

### Debug APK（測試用）- 當前建置

**特點**:
- ✅ 快速建置（5-10分鐘）
- ✅ 可以直接安裝
- ✅ 包含偵錯資訊
- ✅ 檔案較大（~50-80 MB）
- ⚠️ 僅供測試，不可上架

**用途**:
- 開發測試
- 內部測試
- 功能驗證

---

### Release APK/AAB（正式版）- 上架用

**特點**:
- ✅ 優化過的代碼
- ✅ 檔案較小（~20-40 MB）
- ✅ 需要簽名
- ✅ 可以上架 Google Play

**建置方式**:
```bash
cd android
.\gradlew bundleRelease    # 建置 AAB（上架用）
.\gradlew assembleRelease  # 建置 APK（側載用）
```

**注意**: 需要先設置簽名金鑰

---

## 🔐 設置簽名金鑰（正式版需要）

### 生成金鑰：

```bash
keytool -genkey -v -keystore votechaos-release-key.keystore -alias votechaos -keyalg RSA -keysize 2048 -validity 10000
```

### 配置簽名：

**檔案**: `android/app/build.gradle`

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('votechaos-release-key.keystore')
            storePassword 'your-password'
            keyAlias 'votechaos'
            keyPassword 'your-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 📊 建置時間估算

| 步驟 | 首次 | 後續 |
|------|------|------|
| npm install | 3-5分鐘 | 10秒 |
| npm run build | 1-2分鐘 | 30秒 |
| cap sync | 30秒 | 20秒 |
| gradlew assembleDebug | 5-10分鐘 | 1-2分鐘 |
| **總計** | **10-18分鐘** | **2-3分鐘** |

---

## 📱 安裝測試

### 方法 1: ADB（推薦）

```powershell
# 連接手機後
adb devices                                  # 檢查設備
adb install VoteChaos-debug.apk             # 安裝

# 如果已安裝舊版本
adb install -r VoteChaos-debug.apk          # 覆蓋安裝
```

---

### 方法 2: 檔案傳輸

1. 將 `VoteChaos-debug.apk` 複製到手機
2. 用檔案管理器打開
3. 點擊安裝
4. 允許「未知來源」安裝

---

### 方法 3: 透過雲端

1. 上傳 APK 到 Google Drive / Dropbox
2. 在手機上下載
3. 安裝

---

## 🧪 測試檢查清單

### 安裝後測試：

- [ ] APP 圖示正常顯示
- [ ] 啟動畫面顯示
- [ ] 首頁載入正常
- [ ] 可以註冊/登入
- [ ] 可以瀏覽主題
- [ ] 可以投票
- [ ] AdMob 測試廣告顯示
- [ ] 觀看廣告獲得代幣
- [ ] 所有頁面導航正常
- [ ] 返回鍵處理正常

---

## 📝 當前 APP 資訊

### 應用資訊：
```
App Name:     VoteChaos
Package ID:   com.votechaos.app
Version:      1.0.0
Version Code: 1
Min SDK:      22 (Android 5.1)
Target SDK:   33 (Android 13)
```

### 已整合功能：
- ✅ 投票系統
- ✅ 主題創建
- ✅ 搜尋功能
- ✅ 個人資料編輯
- ✅ 任務系統（簽到、觀看廣告）
- ✅ AdMob 廣告（Banner + Rewarded）
- ✅ 檢舉系統
- ✅ 公告系統
- ✅ 歷史記錄
- ✅ 主題編輯/刪除
- ✅ 錯誤處理

### 使用測試 ID：
- AdMob: Google 官方測試 ID
- Supabase: 您的實際專案

---

## 🎯 環境設置指南

### 如果您還沒有安裝環境：

#### 1. 安裝 Node.js

1. 訪問 https://nodejs.org/
2. 下載 LTS 版本（20.x）
3. 執行安裝程式
4. 勾選「Add to PATH」
5. 重啟終端機
6. 驗證：`node --version`

**預計時間**: 5 分鐘

---

#### 2. 安裝 Android Studio

1. 訪問 https://developer.android.com/studio
2. 下載 Windows 版本（~1GB）
3. 執行安裝程式
4. 選擇「Standard」安裝
5. 等待下載 Android SDK（~5GB）
6. 完成安裝

**預計時間**: 30-60 分鐘（視網速）

---

#### 3. 配置 Android SDK

1. 打開 Android Studio
2. More Actions → SDK Manager
3. 確認已安裝：
   - Android SDK Platform 33
   - Android SDK Build-Tools
   - Android SDK Platform-Tools
   - Android Emulator

**預計時間**: 10-20 分鐘

---

#### 4. 設置環境變數（可選但建議）

**Windows**:

1. 右鍵「此電腦」→ 內容 → 進階系統設定
2. 環境變數
3. 新增系統變數：

```
變數名: ANDROID_HOME
變數值: C:\Users\USER\AppData\Local\Android\Sdk
```

4. 編輯 Path，添加：
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
```

---

## 🚀 完整建置命令（環境已設置）

```powershell
# 一鍵建置（複製整段執行）
cd "C:\Users\USER\Documents\工作用\votechaos-main" && `
npm install && `
npm run build && `
npx cap sync android && `
cd android && `
.\gradlew assembleDebug && `
cd .. && `
Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" "VoteChaos-debug-$(Get-Date -Format 'yyyyMMdd-HHmmss').apk" && `
Write-Host "`n✅ APK 建置完成！" -ForegroundColor Green
```

---

## 📦 產出檔案

### Debug APK:
```
檔案名: app-debug.apk 或 VoteChaos-debug.apk
大小: ~50-80 MB
簽名: Debug 簽名（自動）
用途: 測試
有效期: 永久（除非重新建置）
```

### 可以做什麼：
- ✅ 安裝到任何 Android 設備
- ✅ 分享給測試人員
- ✅ 測試所有功能
- ✅ 驗證廣告顯示
- ⚠️ 不可上架 Google Play

---

## 🎊 完成後

### APK 建置成功後：

1. **測試安裝**:
   ```powershell
   adb install VoteChaos-debug.apk
   ```

2. **分享給測試人員**:
   - 上傳到 Google Drive
   - 產生分享連結
   - 傳送給測試人員

3. **收集回饋**:
   - 功能是否正常
   - 是否有 Bug
   - 使用體驗如何

4. **準備正式版**:
   - 修復測試中發現的問題
   - 設置簽名金鑰
   - 建置 Release AAB
   - 準備上架

---

## 📋 檢查清單

### 建置前:
- [ ] Node.js 已安裝
- [ ] Android Studio 已安裝
- [ ] 專案依賴已安裝（npm install）
- [ ] .env.local 已配置
- [ ] AdMob 配置已添加

### 建置中:
- [ ] Web 應用建置成功
- [ ] Capacitor 同步成功
- [ ] Gradle 建置無錯誤

### 建置後:
- [ ] APK 檔案存在
- [ ] 檔案大小正常（50-80MB）
- [ ] 可以安裝到手機
- [ ] APP 可以啟動
- [ ] 所有功能正常

---

## 💡 提示

### 加速建置:

1. **使用 Gradle Daemon**（自動啟用）
2. **增加 Gradle 記憶體**:
   
   **檔案**: `android/gradle.properties`
   ```properties
   org.gradle.jvmargs=-Xmx2048m -XX:MaxPermSize=512m
   ```

3. **啟用建置快取**（預設啟用）

---

## 🎯 下一步

### 建置成功後:

1. **內部測試** (1週)
   - 團隊成員測試
   - 修復發現的 Bug

2. **封閉測試** (2週)
   - 邀請 10-50 用戶
   - 收集詳細回饋

3. **公開測試** (2-4週)
   - Google Play 內部測試軌道
   - 更多用戶參與

4. **正式上架**
   - 修復所有關鍵問題
   - 準備商店素材
   - 提交審核

---

**祝您建置順利！** 🎉

如遇到任何問題，請查看錯誤訊息並參考常見問題，或詢問我協助！🚀


