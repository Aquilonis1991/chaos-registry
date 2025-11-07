# 🚀 VoteChaos APP 快速開始指南

> **目標**: 5分鐘內完成 APP 建置和測試

---

## ⚡ 超快速流程（適合有 Android Studio 的用戶）

```powershell
# 1. 安裝依賴（首次）
npm install

# 2. 建置 Web 應用
npm run build

# 3. 添加 Android 平台（首次）
npx cap add android

# 4. 同步代碼
npx cap sync android

# 5. 打開 Android Studio
npx cap open android

# 6. 在 Android Studio 點擊 Run ▶️
```

完成！您的 APP 將在模擬器或實機上運行。

---

## 📋 詳細步驟（首次設置）

### Step 1: 確認環境

```powershell
# 檢查 Node.js
node --version
# 需要 18.0.0 或更高

# 檢查 npm
npm --version
```

**如果沒有 Node.js**:
1. 訪問 https://nodejs.org/
2. 下載並安裝 LTS 版本
3. 重新打開終端機

---

### Step 2: 安裝專案依賴

```powershell
# 在專案根目錄執行
npm install
```

**這會安裝**:
- Capacitor 核心
- Capacitor Android/iOS
- 所有原生外掛程式
- React 和其他依賴

**預計時間**: 2-5 分鐘

---

### Step 3: 建置 Web 應用

```powershell
npm run build
```

**這會**:
- 編譯 TypeScript
- 打包所有資源
- 生成 `dist/` 資料夾

**預計時間**: 30-60 秒

---

### Step 4: 添加 Android 平台

```powershell
npx cap add android
```

**這會**:
- 創建 `android/` 資料夾
- 設置 Android 專案結構
- 配置 Gradle

**預計時間**: 10-30 秒

---

### Step 5: 同步代碼到 Android

```powershell
npx cap sync android
```

**這會**:
- 複製 `dist/` 到 Android 專案
- 更新原生配置
- 安裝原生依賴

**預計時間**: 5-10 秒

---

### Step 6: 打開 Android Studio

```powershell
npx cap open android
```

**這會**:
- 啟動 Android Studio
- 打開 VoteChaos Android 專案

**首次打開時**: Android Studio 會下載 Gradle 依賴（3-10分鐘）

---

### Step 7: 運行 APP

在 Android Studio 中：

1. **選擇設備**
   - 實體手機（需開啟 USB 偵錯）
   - 或模擬器（建議先創建一個）

2. **點擊 Run ▶️**
   - 等待建置完成
   - APP 會自動安裝並啟動

3. **測試功能**
   - 首頁應顯示公告和主題
   - 可以瀏覽和投票
   - 檢查所有功能正常

---

## 🔄 日常開發流程

### 修改代碼後：

```powershell
# 1. 建置
npm run build

# 2. 同步
npx cap sync android

# 3. 在 Android Studio 中點擊 Run
# （Android Studio 會自動重新安裝）
```

### 快捷方式：

```powershell
# 一鍵建置、同步並打開
npm run android
```

---

## 🎯 測試 iOS APP（僅 macOS）

```bash
# 1. 添加 iOS 平台
npx cap add ios

# 2. 安裝 CocoaPods 依賴
cd ios/App && pod install && cd ../..

# 3. 同步代碼
npx cap sync ios

# 4. 打開 Xcode
npx cap open ios

# 5. 在 Xcode 中選擇模擬器並運行
```

---

## 🐛 常見問題速查

### ❌ "npm: command not found"
**解決**: 安裝 Node.js → https://nodejs.org/

### ❌ "Android Studio not found"
**解決**: 
1. 安裝 Android Studio → https://developer.android.com/studio
2. 安裝 Android SDK
3. 設置環境變數 `ANDROID_HOME`

### ❌ "JAVA_HOME not set"
**解決**:
1. 安裝 JDK 17
2. 設置 `JAVA_HOME` 環境變數
3. 重啟終端

### ❌ APP 白屏
**解決**:
1. 檢查 `.env.local` 是否存在
2. 執行 `npm run build`
3. 執行 `npx cap sync android`
4. 查看 Logcat 錯誤訊息

### ❌ "dist folder not found"
**解決**:
```powershell
npm run build
```

---

## 📊 開發模式對比

| 模式 | 速度 | 適用場景 | 命令 |
|------|------|----------|------|
| Web 開發 | ⚡⚡⚡ 最快 | 開發 UI 和邏輯 | `npm run dev` |
| Android 模擬器 | ⚡⚡ 較快 | 測試原生功能 | `npm run android` |
| 實體設備 | ⚡ 慢 | 最終測試 | Android Studio Run |

**建議**: 大部分時間在 Web 開發，定期在 Android 測試原生功能。

---

## 🎁 額外功能

### 觸覺反饋

在按鈕點擊時添加震動：

```typescript
import { hapticLight } from '@/lib/capacitor';

<Button onClick={() => {
  hapticLight(); // 輕震動
  // 您的邏輯
}}>
  點擊我
</Button>
```

### 檢查平台

```typescript
import { isNative, getPlatform } from '@/lib/capacitor';

if (isNative()) {
  console.log('Running on:', getPlatform()); // 'android' 或 'ios'
}
```

### App 資訊

```typescript
import { getAppInfo } from '@/lib/app-lifecycle';

const info = await getAppInfo();
console.log(`App: ${info.name} v${info.version}`);
```

---

## 📱 生成 APK 測試版（不上架）

在 Android Studio 中：

1. **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**
2. 等待建置完成
3. 點擊通知中的 **locate**
4. 找到 `app-debug.apk`
5. 傳送到手機安裝測試

---

## 🎉 完成！

現在您有：
- ✅ 可在 Android 運行的 APP
- ✅ 可在 iOS 運行的 APP（macOS）
- ✅ 原有的 Web 版本
- ✅ 一套程式碼維護三個平台

**下一步建議**:
1. 🎨 設計 APP 圖示和啟動畫面
2. 🔧 整合 AdMob 廣告
3. 💰 整合內購功能
4. 📲 配置推送通知
5. 🚀 準備上架 Google Play / App Store

需要協助任何步驟，請隨時告訴我！🎊

