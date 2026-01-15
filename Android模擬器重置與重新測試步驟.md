# Android 模擬器重置與重新測試步驟

**目標**: 重置 Android Studio 模擬器，確保所有修改都應用到應用  
**適用於**: 測試 Twitter 登入回調修復

---

## 🔄 完整重置流程

### 步驟 1: 停止應用和模擬器（30秒）

1. **停止應用**
   - 在模擬器中，按返回鍵退出應用
   - 或使用 Android Studio 的「Stop」按鈕

2. **關閉 Logcat**（可選）
   - 在 Android Studio 中關閉 Logcat 窗口

---

### 步驟 2: 清理應用數據（1分鐘）

#### 方法 A: 使用 ADB 命令（推薦）

```bash
# 1. 連接到模擬器（確認設備已連接）
adb devices

# 2. 清理應用數據
adb shell pm clear com.votechaos.app.debug

# 3. 確認清理成功（應該看到 "Success"）
```

#### 方法 B: 在模擬器中手動清理

1. 打開「設置」應用
2. 導航到「應用」→「VoteChaos」
3. 點擊「存儲」
4. 點擊「清除數據」
5. 確認清除

---

### 步驟 3: 清理構建緩存（2分鐘）

#### 在專案目錄執行

```bash
# 1. 進入專案目錄
cd votechaos-main

# 2. 清理前端構建
npm run build

# 3. 進入 Android 目錄
cd android

# 4. 清理 Gradle 緩存
./gradlew clean

# 5. 清理構建目錄（可選，更徹底）
rm -rf app/build
rm -rf build
rm -rf .gradle
```

#### 在 Windows PowerShell 中

```powershell
# 1. 進入專案目錄
cd votechaos-main

# 2. 清理前端構建
npm run build

# 3. 進入 Android 目錄
cd android

# 4. 清理 Gradle 緩存
.\gradlew.bat clean

# 5. 清理構建目錄（可選）
Remove-Item -Recurse -Force app\build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .gradle -ErrorAction SilentlyContinue
```

---

### 步驟 4: 同步 Capacitor（1分鐘）

```bash
# 回到專案根目錄
cd votechaos-main

# 同步 Capacitor（這會將最新的構建同步到 Android 專案）
npm run cap:sync:android
```

**預期輸出**:
```
✔ Copying web assets from dist to android/app/src/main/assets/public
✔ Copying native bridge
✔ Copying capacitor.config.json
✔ Syncing Android project
```

---

### 步驟 5: 重新構建 Android 專案（3-5分鐘）

#### 方法 A: 使用 Android Studio

1. **打開 Android Studio**
   - 打開 `votechaos-main/android` 目錄

2. **同步 Gradle**
   - 點擊「Sync Project with Gradle Files」按鈕（🔄）
   - 或使用快捷鍵：`Ctrl+Shift+O` (Windows) / `Cmd+Shift+O` (Mac)

3. **清理並重新構建**
   - 點擊「Build」→「Clean Project」
   - 等待完成後，點擊「Build」→「Rebuild Project」

4. **安裝到模擬器**
   - 點擊「Run」按鈕（▶️）
   - 或使用快捷鍵：`Shift+F10` (Windows) / `Ctrl+R` (Mac)

#### 方法 B: 使用命令行

```bash
# 進入 Android 目錄
cd votechaos-main/android

# 清理並重新構建
./gradlew clean assembleDebug

# 安裝到模擬器
./gradlew installDebug
```

#### 在 Windows PowerShell 中

```powershell
# 進入 Android 目錄
cd votechaos-main\android

# 清理並重新構建
.\gradlew.bat clean assembleDebug

# 安裝到模擬器
.\gradlew.bat installDebug
```

---

### 步驟 6: 重置模擬器（可選，如果需要完全重置）

#### 方法 A: 冷啟動模擬器

1. **關閉模擬器**
   - 在 Android Studio 中點擊「Stop」按鈕
   - 或關閉模擬器窗口

2. **冷啟動**
   - 在 Android Studio → AVD Manager
   - 找到您的模擬器
   - 點擊「Cold Boot Now」按鈕（❄️）

#### 方法 B: 擦除模擬器數據（完全重置）

1. **關閉模擬器**

2. **在 AVD Manager 中**
   - 找到您的模擬器
   - 點擊「Wipe Data」按鈕（🗑️）
   - 確認擦除

3. **重新啟動模擬器**
   - 點擊「Play」按鈕啟動模擬器

---

### 步驟 7: 驗證安裝（30秒）

1. **檢查應用是否已安裝**
   ```bash
   adb shell pm list packages | grep votechaos
   ```
   
   應該看到：
   ```
   package:com.votechaos.app.debug
   ```

2. **檢查應用版本**
   ```bash
   adb shell dumpsys package com.votechaos.app.debug | grep versionName
   ```

3. **確認應用在模擬器中**
   - 在模擬器中查看應用列表
   - 確認 VoteChaos 應用存在

---

### 步驟 8: 打開 Logcat 並開始測試（30秒）

1. **打開 Logcat**
   ```bash
   # 過濾 VoteChaos 標籤
   adb logcat -s VoteChaos
   
   # 或過濾多個標籤
   adb logcat -s VoteChaos:* Capacitor:* OAuthCallbackHandler:* app-lifecycle:*
   ```

2. **啟動應用**
   - 在模擬器中點擊 VoteChaos 應用圖標
   - 或使用命令：
   ```bash
   adb shell am start -n com.votechaos.app.debug/.MainActivity
   ```

3. **檢查初始日誌**
   ```
   應該看到：
   [VoteChaos] MainActivity onCreate start
   [VoteChaos] MainActivity onCreate complete
   [VoteChaos] MainActivity onStart
   [VoteChaos] MainActivity onResume
   ```

---

## ✅ 驗證檢查清單

### 構建驗證

- [ ] ✅ `npm run build` 成功完成
- [ ] ✅ `npm run cap:sync:android` 成功完成
- [ ] ✅ `./gradlew clean` 成功完成
- [ ] ✅ `./gradlew assembleDebug` 成功完成
- [ ] ✅ `./gradlew installDebug` 成功完成

### 應用驗證

- [ ] ✅ 應用已安裝在模擬器上
- [ ] ✅ 應用可以正常啟動
- [ ] ✅ 沒有崩潰或錯誤
- [ ] ✅ Logcat 顯示正常日誌

### 功能驗證

- [ ] ✅ 登入頁面正常顯示
- [ ] ✅ Twitter 登入按鈕可見
- [ ] ✅ 點擊按鈕後 WebView 載入授權頁

---

## 🚀 快速重置命令（一鍵執行）

### Windows PowerShell 腳本

創建 `reset-and-test.ps1`:

```powershell
# 重置並重新測試腳本
Write-Host "開始重置流程..." -ForegroundColor Green

# 1. 清理應用數據
Write-Host "清理應用數據..." -ForegroundColor Yellow
adb shell pm clear com.votechaos.app.debug

# 2. 清理前端構建
Write-Host "清理前端構建..." -ForegroundColor Yellow
cd votechaos-main
npm run build

# 3. 同步 Capacitor
Write-Host "同步 Capacitor..." -ForegroundColor Yellow
npm run cap:sync:android

# 4. 清理 Android 構建
Write-Host "清理 Android 構建..." -ForegroundColor Yellow
cd android
.\gradlew.bat clean

# 5. 重新構建並安裝
Write-Host "重新構建並安裝..." -ForegroundColor Yellow
.\gradlew.bat assembleDebug installDebug

Write-Host "重置完成！現在可以開始測試了。" -ForegroundColor Green
Write-Host "打開 Logcat: adb logcat -s VoteChaos" -ForegroundColor Cyan
```

### Linux/Mac Bash 腳本

創建 `reset-and-test.sh`:

```bash
#!/bin/bash

echo "開始重置流程..."

# 1. 清理應用數據
echo "清理應用數據..."
adb shell pm clear com.votechaos.app.debug

# 2. 清理前端構建
echo "清理前端構建..."
cd votechaos-main
npm run build

# 3. 同步 Capacitor
echo "同步 Capacitor..."
npm run cap:sync:android

# 4. 清理 Android 構建
echo "清理 Android 構建..."
cd android
./gradlew clean

# 5. 重新構建並安裝
echo "重新構建並安裝..."
./gradlew assembleDebug installDebug

echo "重置完成！現在可以開始測試了。"
echo "打開 Logcat: adb logcat -s VoteChaos"
```

---

## 📋 完整重置步驟總結

### 標準流程（推薦）

1. ✅ **清理應用數據** → `adb shell pm clear com.votechaos.app.debug`
2. ✅ **清理前端構建** → `npm run build`
3. ✅ **同步 Capacitor** → `npm run cap:sync:android`
4. ✅ **清理 Android 構建** → `cd android && ./gradlew clean`
5. ✅ **重新構建並安裝** → `./gradlew assembleDebug installDebug`
6. ✅ **打開 Logcat** → `adb logcat -s VoteChaos`
7. ✅ **啟動應用並測試**

---

## ⚠️ 常見問題

### 問題 1: Gradle 構建失敗

**症狀**: `./gradlew clean` 或 `./gradlew assembleDebug` 失敗

**解決方案**:
```bash
# 清理 Gradle 緩存
cd android
rm -rf .gradle
rm -rf build
rm -rf app/build

# 重新同步
./gradlew clean --refresh-dependencies
```

---

### 問題 2: Capacitor 同步失敗

**症狀**: `npm run cap:sync:android` 失敗

**解決方案**:
```bash
# 確保已構建前端
npm run build

# 重新同步
npm run cap:sync:android

# 如果還是失敗，檢查 node_modules
npm install
```

---

### 問題 3: 應用安裝失敗

**症狀**: `./gradlew installDebug` 失敗

**解決方案**:
```bash
# 確認模擬器已連接
adb devices

# 卸載舊版本
adb uninstall com.votechaos.app.debug

# 重新安裝
./gradlew installDebug
```

---

### 問題 4: 模擬器無法連接

**症狀**: `adb devices` 顯示空列表

**解決方案**:
1. 確認模擬器已啟動
2. 在 Android Studio 中檢查 AVD Manager
3. 重啟 ADB:
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```

---

## 🎯 測試前最終檢查

### 必須確認

- [ ] ✅ 模擬器已啟動並連接
- [ ] ✅ 應用數據已清理
- [ ] ✅ 前端已重新構建
- [ ] ✅ Capacitor 已同步
- [ ] ✅ Android 專案已重新構建
- [ ] ✅ 應用已重新安裝
- [ ] ✅ Logcat 已打開
- [ ] ✅ 應用可以正常啟動

---

## 📝 測試記錄

**重置時間**: ___________  
**重置方式**: [ ] 標準流程  [ ] 快速腳本  [ ] 完全重置

**構建結果**:
- [ ] ✅ 成功
- [ ] ❌ 失敗（請記錄錯誤）

**應用狀態**:
- [ ] ✅ 正常啟動
- [ ] ❌ 無法啟動（請記錄錯誤）

**準備測試**:
- [ ] ✅ 已準備好開始測試
- [ ] ❌ 還有問題需要解決

---

**重置指南生成時間**: 2025年1月  
**最後更新**: 2025年1月
