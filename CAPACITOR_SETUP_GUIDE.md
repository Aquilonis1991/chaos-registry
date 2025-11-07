# 📱 Capacitor APP 轉換完整指南

## 🎯 目標

將 VoteChaos Web 應用轉換成可在 iOS 和 Android 上運行的原生 APP。

---

## ✅ 已完成的準備工作

- ✅ 更新 `package.json` - 添加 Capacitor 依賴和腳本
- ✅ 創建 `capacitor.config.ts` - Capacitor 核心配置
- ✅ 創建 `src/lib/capacitor.ts` - Capacitor 工具函數
- ✅ 創建 `src/lib/app-lifecycle.ts` - APP 生命週期管理
- ✅ 創建 `src/lib/push-notifications.ts` - 推送通知整合
- ✅ 創建 `src/lib/admob-native.ts` - AdMob 配置
- ✅ 更新 `index.html` - 添加 APP 專用 meta 標籤
- ✅ 更新 `vite.config.ts` - 優化建置設定
- ✅ 更新 `src/main.tsx` - 初始化 Capacitor

---

## 🚀 執行步驟

### 前置需求

請確認您的系統已安裝：

#### Windows 開發 Android APP：
- ✅ Node.js 18+ 或 Bun
- ✅ Java JDK 17+
- ✅ Android Studio（含 Android SDK）
- ✅ Gradle

#### macOS 開發 iOS APP：
- ✅ Node.js 18+
- ✅ Xcode 14+
- ✅ CocoaPods
- ✅ iOS Simulator

---

## 📝 Step 1: 安裝依賴

```powershell
# 安裝所有 npm 依賴（包含 Capacitor）
npm install

# 驗證安裝
npx cap --version
```

**預期輸出**: Capacitor CLI 版本號（例如：6.1.2）

---

## 📝 Step 2: 初始化 Capacitor

```powershell
# 初始化 Capacitor（已有 capacitor.config.ts 可跳過）
# npx cap init

# 或者手動確認配置
npx cap ls
```

這會顯示當前配置和已安裝的平台。

---

## 📝 Step 3: 建置 Web 應用

```powershell
# 建置生產版本
npm run build

# 驗證 dist 資料夾已生成
ls dist
```

**重要**: Capacitor 需要先建置 Web 應用才能同步到原生平台。

---

## 📝 Step 4: 添加 Android 平台

```powershell
# 添加 Android 平台
npm run cap:add:android

# 或使用完整命令
npx cap add android
```

這會在專案根目錄創建 `android/` 資料夾。

### 配置 Android：

1. **打開 Android Studio**
   ```powershell
   npm run cap:open:android
   ```

2. **配置應用 ID**
   - 已在 `capacitor.config.ts` 中設定為 `com.votechaos.app`
   - 可在 Android Studio 修改

3. **設置簽名（發布時需要）**
   - 生成 keystore
   - 在 `android/app/build.gradle` 中配置

---

## 📝 Step 5: 添加 iOS 平台（僅 macOS）

```bash
# 添加 iOS 平台
npm run cap:add:ios

# 或使用完整命令
npx cap add ios
```

這會在專案根目錄創建 `ios/` 資料夾。

### 配置 iOS：

1. **安裝 CocoaPods 依賴**
   ```bash
   cd ios/App
   pod install
   cd ../..
   ```

2. **打開 Xcode**
   ```bash
   npm run cap:open:ios
   ```

3. **配置 Bundle ID**
   - 在 Xcode 中修改為 `com.votechaos.app`
   - 設置開發團隊

---

## 📝 Step 6: 同步代碼到原生平台

每次修改 Web 代碼後，需要同步到原生平台：

```powershell
# 同步到所有平台
npm run cap:sync

# 或單獨同步
npm run cap:sync:android   # 僅 Android
npm run cap:sync:ios       # 僅 iOS
```

**此命令會**：
1. 執行 `npm run build`
2. 複製 `dist/` 到原生專案
3. 更新原生依賴

---

## 📝 Step 7: 運行 APP

### Android：

**方法 A：使用 Android Studio（推薦）**
```powershell
# 打開 Android Studio
npm run cap:open:android

# 然後在 Android Studio 中：
# 1. 選擇設備或模擬器
# 2. 點擊 Run ▶️
```

**方法 B：使用命令行**
```powershell
# 直接運行到連接的設備
npm run cap:run:android
```

### iOS（僅 macOS）：

```bash
# 打開 Xcode
npm run cap:open:ios

# 然後在 Xcode 中：
# 1. 選擇模擬器
# 2. 點擊 Run ▶️
```

---

## 🎨 APP 圖示和啟動畫面

### 準備資源

1. **創建圖示**
   - 在 `resources/` 資料夾放入 `icon.png`（1024x1024px）
   - 背景透明的 PNG

2. **創建啟動畫面**
   - 在 `resources/` 資料夾放入 `splash.png`（2732x2732px）
   - 中央放置 Logo

3. **自動生成各尺寸**
   ```powershell
   # 安裝工具
   npm install -g @capacitor/assets

   # 生成
   npx capacitor-assets generate
   ```

---

## 🔧 常見問題

### Q1: Android Studio 找不到 JDK？
**A**: 
1. 安裝 JDK 17
2. 設置 `JAVA_HOME` 環境變數
3. 重啟 Android Studio

### Q2: iOS 建置失敗？
**A**:
1. 執行 `pod install`
2. 檢查 Xcode 版本（需要 14+）
3. 設置開發團隊

### Q3: 同步時出現錯誤？
**A**:
1. 確認 `dist/` 資料夾存在
2. 執行 `npm run build`
3. 刪除 `android/` 或 `ios/` 重新添加

### Q4: APP 白屏？
**A**:
1. 檢查控制台錯誤
2. 確認 Supabase 連接正常
3. 檢查 `.env.local` 配置

---

## 📊 開發工作流程

### 日常開發：

```powershell
# 1. 在瀏覽器中開發（最快）
npm run dev

# 2. 完成功能後建置
npm run build

# 3. 同步到原生平台
npm run cap:sync:android

# 4. 在 Android Studio 運行測試
npm run android
```

### 發布前：

```powershell
# 1. 建置生產版本
npm run build

# 2. 同步
npm run cap:sync

# 3. 在 Android Studio 生成 APK/AAB
# 4. 在 Xcode 生成 IPA
```

---

## 🎯 功能清單

### ✅ 已整合的原生功能：

- ✅ **App 生命週期** - 前景/背景切換
- ✅ **返回按鈕** - Android 返回鍵處理
- ✅ **狀態欄** - 深色樣式
- ✅ **啟動畫面** - 自動隱藏
- ✅ **鍵盤管理** - iOS 輔助欄
- ✅ **觸覺反饋** - 按鈕點擊震動
- ✅ **推送通知** - 基礎框架（需配置 Firebase）
- ✅ **深層連結** - 支援 `votechaos://` 協議

### ⏳ 待整合的功能：

- ⏳ **AdMob 廣告** - 需要 AdMob Account
- ⏳ **內購** - 需要 Google Play/App Store 配置
- ⏳ **Firebase Push** - 需要 Firebase 專案
- ⏳ **分享功能** - 社交分享
- ⏳ **相機/相簿** - 上傳頭像

---

## 📦 打包發布

### Android APK/AAB：

1. **生成簽名金鑰**
   ```powershell
   keytool -genkey -v -keystore votechaos.keystore -alias votechaos -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **配置簽名**
   - 在 `android/app/build.gradle` 添加簽名配置
   - 在 `android/gradle.properties` 添加金鑰資訊

3. **建置 AAB**
   - 在 Android Studio: Build > Generate Signed Bundle/APK
   - 選擇 Android App Bundle (AAB)
   - 上傳到 Google Play Console

### iOS IPA：

1. **在 Xcode 配置**
   - 設置開發團隊
   - 配置 Bundle ID
   - 添加簽名證書

2. **建置**
   - Product > Archive
   - Distribute App
   - 上傳到 App Store Connect

---

## 🔐 環境變數處理

Capacitor APP 需要特殊處理環境變數：

### 方法 A：建置時注入
在 `vite.config.ts` 中配置：
```typescript
define: {
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
}
```

### 方法 B：使用 Capacitor Configuration
在原生專案中設置環境變數（更安全）

---

## 🧪 測試清單

### 功能測試：

- [ ] APP 正常啟動
- [ ] 登入/註冊功能正常
- [ ] 主題列表顯示
- [ ] 投票功能正常
- [ ] 歷史紀錄查看
- [ ] 推送通知接收
- [ ] 返回按鈕正常
- [ ] 觸覺反饋正常
- [ ] 深層連結跳轉

### 性能測試：

- [ ] 啟動速度 < 3秒
- [ ] 頁面切換流暢
- [ ] 網路請求正常
- [ ] 記憶體使用合理

### 兼容性測試：

- [ ] Android 6.0+ (API 23+)
- [ ] iOS 13.0+
- [ ] 不同螢幕尺寸
- [ ] 橫豎屏切換

---

## 📱 平台特定調整

### Android 專屬：

1. **返回按鈕** - 已處理
2. **狀態欄顏色** - 已配置為黑色
3. **權限管理** - 在 AndroidManifest.xml 中聲明
4. **多語系** - 在 `res/values-zh-rTW/` 中配置

### iOS 專屬：

1. **安全區域** - 使用 `viewport-fit=cover`
2. **狀態欄樣式** - 淺色內容
3. **鍵盤輔助欄** - 已啟用
4. **推送證書** - 需要 Apple Developer Account

---

## 🔄 開發建議工作流程

```powershell
# 步驟 1: Web 開發（最快）
npm run dev
# 在瀏覽器中開發和測試

# 步驟 2: 建置並同步
npm run build
npm run cap:sync:android

# 步驟 3: 原生測試
npm run android
# 在 Android Studio 測試

# 步驟 4: 修復問題
# 回到步驟 1

# 步驟 5: 準備發布
npm run build
# 在 Android Studio 生成 APK/AAB
```

---

## 📦 快速命令參考

```powershell
# 開發
npm run dev                    # Web 開發模式
npm run build                  # 建置生產版本

# Capacitor
npm run cap:sync              # 同步到所有平台
npm run cap:sync:android      # 僅同步 Android
npm run cap:sync:ios          # 僅同步 iOS

# 打開原生 IDE
npm run android               # Android Studio
npm run ios                   # Xcode（僅 macOS）

# 運行
npm run cap:run:android       # 運行到 Android 設備
npm run cap:run:ios           # 運行到 iOS 設備
```

---

## 🎨 UI 優化建議

### 已在配置中處理：

- ✅ 禁用縮放 (`user-scalable=no`)
- ✅ 安全區域適配 (`viewport-fit=cover`)
- ✅ 觸控高亮禁用
- ✅ 電話號碼自動識別禁用

### 建議額外調整：

1. **觸控目標大小** - 至少 44x44px
2. **底部導航** - 考慮原生底部安全區
3. **狀態欄適配** - 確保內容不被遮擋
4. **橫屏支援** - 測試橫屏布局

---

## 🔌 原生功能整合狀態

| 功能 | 狀態 | 說明 |
|------|------|------|
| App 生命週期 | ✅ 完成 | 前景/背景切換處理 |
| 狀態欄 | ✅ 完成 | 深色樣式 |
| 啟動畫面 | ✅ 完成 | 自動隱藏 |
| 觸覺反饋 | ✅ 完成 | 按鈕震動 |
| 推送通知 | ⚠️ 框架就緒 | 需配置 Firebase |
| AdMob | ⚠️ 配置就緒 | 需 AdMob Account |
| 內購 | ⏳ 待整合 | 需商店配置 |
| 分享 | ⏳ 待整合 | 社交分享 |
| 相機 | ⏳ 待整合 | 頭像上傳 |

---

## 📊 遷移資料庫（提醒）

在測試 APP 前，請確認：

1. ✅ 已執行資料庫遷移（參考 `QUICK_SQL_MIGRATION.md`）
2. ✅ `.env.local` 已正確配置
3. ✅ Supabase 連接正常

---

## 🎯 下一步

### 立即可做：

1. **安裝依賴**
   ```powershell
   npm install
   ```

2. **建置應用**
   ```powershell
   npm run build
   ```

3. **添加 Android 平台**
   ```powershell
   npm run cap:add:android
   ```

4. **同步代碼**
   ```powershell
   npm run cap:sync:android
   ```

5. **打開 Android Studio**
   ```powershell
   npm run android
   ```

6. **運行 APP** 🎉

---

## 💡 重要提示

### ⚠️ 第一次建置可能需要：

1. **下載 Gradle 依賴** - 約5-10分鐘
2. **下載 Android SDK** - 如果未安裝
3. **同步 CocoaPods**（iOS）- 約3-5分鐘

### ⚠️ 環境問題：

如果您的電腦沒有 npm/Node.js：

1. **安裝 Node.js**
   - 下載：https://nodejs.org/
   - 選擇 LTS 版本（18.x 或 20.x）

2. **驗證安裝**
   ```powershell
   node --version
   npm --version
   ```

3. **然後繼續上述步驟**

---

## 📞 需要協助？

如果遇到問題：

1. **檢查日誌**
   - Android: Logcat
   - iOS: Xcode Console
   - Web: Browser DevTools

2. **常見錯誤**
   - 建置失敗 → 檢查 `npm run build`
   - 白屏 → 檢查控制台錯誤
   - 網路錯誤 → 檢查 Supabase 配置

3. **官方文檔**
   - Capacitor: https://capacitorjs.com/docs
   - Android: https://developer.android.com/
   - iOS: https://developer.apple.com/

---

## 🎉 完成後

您將擁有：

- 📱 Android APP（.apk 或 .aab）
- 📱 iOS APP（.ipa）
- 🌐 Web APP（保留）
- 🔄 一套程式碼三個平台！

**恭喜您將 VoteChaos 轉換成 APP！** 🎊

