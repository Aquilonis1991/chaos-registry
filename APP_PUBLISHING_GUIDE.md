# 📲 VoteChaos APP 發布指南

## 🎯 完整發布流程

從開發到上架 Google Play Store 和 Apple App Store 的完整指南。

---

## 📱 Android 發布流程

### Step 1: 準備 Google Play Console 帳號

1. **註冊開發者帳號**
   - 訪問：https://play.google.com/console
   - 一次性註冊費：USD $25
   - 填寫開發者資訊

2. **創建應用**
   - 點擊「創建應用程式」
   - 填寫應用名稱：VoteChaos
   - 選擇語言：繁體中文
   - 選擇類型：應用程式

---

### Step 2: 生成簽名金鑰

```powershell
# 創建簽名金鑰（僅需一次，請妥善保管！）
keytool -genkey -v -keystore votechaos-release.keystore -alias votechaos -keyalg RSA -keysize 2048 -validity 10000

# 輸入資訊：
# - 密碼（請記住）
# - 姓名/組織資訊
# - 確認所有資訊
```

**⚠️ 重要**: 這個金鑰非常重要！
- 遺失將無法更新 APP
- 請備份到安全位置
- 絕不要提交到 Git

---

### Step 3: 配置簽名

1. **創建 `android/keystore.properties`**:
   ```properties
   storePassword=您的密碼
   keyPassword=您的密碼
   keyAlias=votechaos
   storeFile=../votechaos-release.keystore
   ```

2. **修改 `android/app/build.gradle`**:
   ```gradle
   // 在 android { 之前添加
   def keystorePropertiesFile = rootProject.file("keystore.properties")
   def keystoreProperties = new Properties()
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   }

   android {
       ...
       signingConfigs {
           release {
               keyAlias keystoreProperties['keyAlias']
               keyPassword keystoreProperties['keyPassword']
               storeFile file(keystoreProperties['storeFile'])
               storePassword keystoreProperties['storePassword']
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

### Step 4: 建置 AAB（Android App Bundle）

```powershell
# 方法 A: 在 Android Studio
# 1. Build > Generate Signed Bundle/APK
# 2. 選擇 Android App Bundle
# 3. 選擇簽名金鑰
# 4. 選擇 release
# 5. 完成

# 方法 B: 命令行
cd android
./gradlew bundleRelease
# AAB 位於: android/app/build/outputs/bundle/release/app-release.aab
```

---

### Step 5: 上傳到 Google Play Console

1. **進入 Google Play Console**
   - 選擇您的應用

2. **完成商店資訊**
   - **應用詳情**:
     - 應用名稱：VoteChaos - 投票混亂製造機
     - 簡短說明：最好玩的投票平台
     - 完整說明：（詳細介紹功能）
   
   - **圖形資源**:
     - 應用程式圖示：512x512px
     - 功能圖片：1024x500px
     - 螢幕截圖：至少 2 張（手機/平板）
   
   - **分類**:
     - 應用程式：社交
     - 標籤：投票、討論、社群

3. **內容分級**
   - 填寫問卷
   - 獲得分級

4. **目標受眾**
   - 選擇年齡層
   - 是否針對兒童

5. **隱私權政策**
   - 提供隱私權政策 URL
   - 您的應用已有：`https://yourdomain.com/privacy`

6. **上傳 AAB**
   - 生產 > 版本 > 創建新版本
   - 上傳 `app-release.aab`
   - 填寫版本資訊

7. **測試**
   - 內部測試 → 封閉測試 → 開放測試 → 生產

8. **送審**
   - 檢查所有項目完成
   - 提交審核（通常 1-3 天）

---

## 🍎 iOS 發布流程（需要 macOS）

### Step 1: Apple Developer 帳號

1. **註冊**
   - 訪問：https://developer.apple.com
   - 年費：USD $99

2. **創建 App ID**
   - Certificates, IDs & Profiles
   - Identifiers > App IDs
   - Bundle ID: `com.votechaos.app`

---

### Step 2: 在 Xcode 配置

```bash
# 打開專案
npx cap open ios
```

在 Xcode 中：

1. **選擇專案** > **Signing & Capabilities**
2. **選擇團隊**（您的 Apple Developer 帳號）
3. **確認 Bundle ID**: `com.votechaos.app`
4. **啟用功能**:
   - Push Notifications
   - Sign in with Apple（如果使用）

---

### Step 3: 建置 Archive

1. **在 Xcode**:
   - Product > Scheme > Edit Scheme
   - Run > Build Configuration > Release
   
2. **Archive**:
   - Product > Archive
   - 等待建置完成

3. **上傳**:
   - Window > Organizer
   - 選擇 Archive
   - Distribute App
   - App Store Connect
   - Upload

---

### Step 4: App Store Connect

1. **創建 APP**
   - 訪問：https://appstoreconnect.apple.com
   - My Apps > + > New App
   - 填寫基本資訊

2. **準備提交**
   - **螢幕截圖** - 各種尺寸（6.5", 5.5"等）
   - **App 預覽影片**（選填）
   - **描述** - 繁體中文和英文
   - **關鍵字** - 投票、討論、社群
   - **支援 URL** - 您的網站
   - **隱私權政策 URL**

3. **版本資訊**
   - 版本號：1.0.0
   - Build：1
   - 新功能：初版發布

4. **送審**
   - App Review Information
   - 提交審核（通常 1-2 天）

---

## 📸 所需素材清單

### Google Play:

- [ ] 應用程式圖示：512x512px PNG
- [ ] 功能圖片：1024x500px JPG/PNG
- [ ] 手機螢幕截圖：至少 2 張（1080x1920 推薦）
- [ ] 7吋平板截圖：至少 2 張（選填）
- [ ] 10吋平板截圖：至少 2 張（選填）
- [ ] 簡短說明：80 字以內
- [ ] 完整說明：4000 字以內
- [ ] 隱私權政策 URL

### App Store:

- [ ] 應用程式圖示：1024x1024px PNG
- [ ] 6.5" 顯示器截圖：1284x2778px（至少 3 張）
- [ ] 5.5" 顯示器截圖：1242x2208px（至少 3 張）
- [ ] iPad Pro 截圖：2048x2732px（選填）
- [ ] App 預覽影片：15-30秒（選填）
- [ ] 描述：4000 字以內
- [ ] 關鍵字：100 字以內
- [ ] 支援 URL
- [ ] 隱私權政策 URL

---

## 🎨 建議的螢幕截圖

### 必須包含的畫面：

1. **首頁** - 顯示主題列表和公告
2. **投票頁面** - 顯示投票介面
3. **建立主題** - 顯示創建流程
4. **個人資料** - 顯示代幣和紀錄
5. **投票結果** - 顯示統計圖表

### 截圖技巧：

- 使用乾淨的測試資料
- 確保文字清晰可讀
- 展示核心功能
- 可使用框架或背景美化

---

## 💰 應用內購設置

### Google Play 內購：

1. **在 Play Console**:
   - 營利 > 產品 > 受管理的產品
   - 創建產品 ID（例如：`tokens_100`, `tokens_500`）

2. **設置價格**:
   - 按照您的儲值方案設置

3. **整合程式碼**:
   ```typescript
   // 未來使用 @capacitor-community/in-app-purchases
   ```

### App Store 內購：

1. **在 App Store Connect**:
   - 功能 > App 內購買項目
   - 創建消耗型項目

2. **稅務設定**:
   - 填寫稅務資訊
   - 設置銀行帳戶

---

## 📊 版本管理

### 版本號規則：

- **Major.Minor.Patch** (例如: 1.0.0)
- **Major**: 重大更新（UI 改版、核心功能變更）
- **Minor**: 新功能添加
- **Patch**: Bug 修復

### Android versionCode:
- 每次發布必須遞增
- 從 1 開始
- 例如: 1, 2, 3, 4...

### 更新版本：

在 `capacitor.config.ts`:
```typescript
version: '1.0.1',
```

在 `android/app/build.gradle`:
```gradle
versionCode 2
versionName "1.0.1"
```

在 `ios/App/App.xcodeproj/project.pbxproj`:
- 在 Xcode 中修改 Version 和 Build

---

## 🔒 安全檢查清單

發布前必須檢查：

- [ ] 移除所有測試 API 金鑰
- [ ] 使用正式的 AdMob ID
- [ ] 環境變數正確設置
- [ ] 沒有 console.log 敏感資訊
- [ ] ProGuard 規則正確（Android）
- [ ] 代碼混淆啟用
- [ ] HTTPS 連接
- [ ] 隱私權政策完整

---

## 📈 上架後維護

### 更新流程：

1. **開發新功能**
   ```powershell
   npm run dev
   ```

2. **建置新版本**
   ```powershell
   npm run build
   npx cap sync
   ```

3. **遞增版本號**
   - versionCode + 1
   - versionName 更新

4. **建置 AAB/IPA**
   - Android Studio / Xcode

5. **上傳到商店**
   - Play Console / App Store Connect

6. **填寫更新說明**
   - 新功能
   - Bug 修復

7. **送審**

### 監控：

- **Google Play Console**:
  - 崩潰報告
  - ANR（無響應）
  - 用戶評論

- **App Store Connect**:
  - 崩潰分析
  - 用戶評論

- **Firebase Analytics**（建議整合）:
  - 用戶行為
  - 留存率
  - 轉換率

---

## 🎁 額外整合建議

### 1. Firebase（推薦）

**用途**: 
- Push Notifications
- Analytics
- Crashlytics
- Remote Config

**設置**:
```powershell
# 安裝依賴
npm install @capacitor-firebase/analytics
npm install @capacitor-firebase/messaging
npm install @capacitor-firebase/crashlytics
```

### 2. AdMob Community Plugin

**用途**: 顯示廣告

**設置**:
```powershell
npm install @capacitor-community/admob
npx cap sync
```

### 3. In-App Purchases

**用途**: 內購功能

**設置**:
```powershell
npm install @capacitor-community/in-app-purchases
npx cap sync
```

### 4. Social Sharing

**用途**: 分享到社交平台

**設置**:
```powershell
npm install @capacitor/share
npx cap sync
```

---

## 🧪 測試策略

### 內部測試（1週）:
- 團隊成員測試
- 修復明顯 Bug
- 優化性能

### 封閉測試（1-2週）:
- 邀請 20-100 位測試者
- 收集反饋
- 修復問題

### 開放測試（2-4週）:
- 公開測試連結
- 大規模測試
- 最終優化

### 正式發布:
- 選擇發布時間
- 準備行銷素材
- 監控用戶反饋

---

## 📋 審核注意事項

### Google Play 審核重點：

1. **內容政策** - 無違規內容
2. **隱私政策** - 必須提供
3. **權限使用** - 合理且有說明
4. **目標受眾** - 正確設置
5. **廣告** - 符合廣告政策

### App Store 審核重點：

1. **功能完整** - 無測試內容、無損壞功能
2. **隱私權限** - 清楚說明用途
3. **設計規範** - 符合 HIG（人機介面指南）
4. **效能** - 無崩潰、響應快速
5. **元數據** - 截圖和描述準確

---

## 💡 審核加速技巧

### 提高通過率：

1. **詳細的版本說明** - 清楚描述功能
2. **測試帳號** - 提供測試帳號給審核員
3. **完整的隱私政策** - 說明所有數據使用
4. **回應快速** - 審核問題及時回覆
5. **遵循指南** - 完全符合商店政策

---

## 🌍 多語系發布

### 建議支援的語言：

1. **繁體中文**（主要）
2. **簡體中文**
3. **英文**
4. **日文**（如需要）

### 需要翻譯的內容：

- 商店描述
- 螢幕截圖文字
- 版本更新說明
- APP 內文字（使用 `ui_texts` 表）

---

## 📊 發布時間表範例

| 階段 | 時間 | 活動 |
|------|------|------|
| 週 1 | 開發完成 | 最終測試 |
| 週 2 | 準備素材 | 截圖、描述、圖示 |
| 週 3 | 內部測試 | 團隊測試 |
| 週 4-5 | 封閉測試 | Beta 測試 |
| 週 6-7 | 開放測試 | 公開測試 |
| 週 8 | 提交審核 | Google Play + App Store |
| 週 9 | 審核通過 | 正式上架 🎉 |

---

## 🎯 上架清單

### 提交前最終檢查：

#### 技術檢查：
- [ ] 所有功能正常運作
- [ ] 無控制台錯誤
- [ ] 測試所有頁面
- [ ] 測試所有按鈕
- [ ] 網路錯誤處理
- [ ] 載入狀態顯示
- [ ] 記憶體無洩漏

#### 內容檢查：
- [ ] 所有文字正確
- [ ] 無測試資料
- [ ] 無 Lorem ipsum
- [ ] 無佔位圖片
- [ ] 隱私政策完整
- [ ] 服務條款完整

#### 商店檢查：
- [ ] 應用名稱正確
- [ ] 描述吸引人
- [ ] 截圖精美
- [ ] 圖示專業
- [ ] 分類正確
- [ ] 關鍵字優化

#### 法律檢查：
- [ ] 隱私政策
- [ ] 服務條款
- [ ] 內容分級
- [ ] 版權聲明
- [ ] 授權正確

---

## 🎊 恭喜！

完成上述步驟後，您的 VoteChaos APP 將正式上架！

**記住**：
- 定期更新
- 回應用戶評論
- 監控崩潰報告
- 持續優化體驗

祝您的 APP 大獲成功！🚀

