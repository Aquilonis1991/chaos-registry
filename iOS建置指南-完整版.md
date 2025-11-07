# 📱 iOS 建置與部署完整指南

> **專案**: VoteChaos  
> **平台**: iOS  
> **適用於**: 開發、測試、生產環境

---

## ✅ 目前配置狀態

### 已完成的配置：

- ✅ **Capacitor iOS 已初始化** (`com.votechaos.app`)
- ✅ **AdMob 依賴已安裝** (`@capacitor-community/admob@6.2.0`)
- ✅ **AdMob 測試 ID 已配置**
- ✅ **Info.plist 已配置**
- ✅ **追蹤權限已添加**
- ✅ **網路安全配置已添加**
- ✅ **AdMob Service 代碼已完整** (`src/lib/admob.ts`)
- ✅ **測試廣告功能已實現** (獎勵廣告、Banner 廣告、插頁廣告)

---

## 🚀 快速建置流程

### 一鍵建置命令：

```powershell
# 在專案根目錄執行
npm run ios
```

**注意**：iOS 建置需要在 macOS 上執行（需要 Xcode）

---

## ⚠️ 重要前提條件

### 必備環境（僅 macOS）：

- [ ] **macOS 系統**（Windows 無法建置 iOS）
- [ ] **Xcode**（從 App Store 安裝）
- [ ] **Xcode Command Line Tools**
  ```bash
  xcode-select --install
  ```
- [ ] **CocoaPods**（iOS 依賴管理工具）
  ```bash
  sudo gem install cocoapods
  ```
- [ ] **Apple Developer 帳號**（建置到設備需要）

---

## 📋 詳細步驟（首次建置）

### 步驟 1: 檢查環境

```bash
# 檢查 Node.js
node --version    # 應該顯示 v18.x 或更高

# 檢查 CocoaPods
pod --version

# 檢查 Xcode
xcodebuild -version
```

### 步驟 2: 安裝 iOS 依賴

```bash
# 在專案根目錄執行
cd ios/App

# 安裝 CocoaPods 依賴
pod install

# 返回根目錄
cd ../..
```

### 步驟 3: 建置並同步

```bash
# 建置 React 應用到 dist 資料夾
npm run build

# 同步到 iOS 專案
npx cap sync ios

# 打開 Xcode
npx cap open ios
```

### 步驟 4: 在 Xcode 中建置

#### 方法 A: 圖形界面建置

1. 等待 Xcode 索引完成（首次 1-5 分鐘）
2. 選擇目標設備或模擬器
3. 頂部選單：`Product` → `Build` (⌘ + B)
4. 建置成功後：`Product` → `Run` (⌘ + R)

#### 方法 B: 模擬器測試

1. 選擇 iOS 模擬器（例如：iPhone 15 Pro）
2. 點擊左上角「▶️ Run」按鈕
3. 等待編譯完成，模擬器會自動啟動

#### 方法 C: 設備測試

1. 連接 iPhone/iPad 到 Mac
2. 在設備上：設定 → 一般 → VPN與裝置管理 → 信任開發者
3. 在 Xcode 選擇您的設備
4. 點擊「▶️ Run」

---

## 🔧 Info.plist 配置確認

### 當前配置（測試環境）：

```xml
<!-- AdMob App ID（測試用）-->
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-3940256099942544~1458002511</string>

<!-- 追蹤權限（iOS 14.5+）-->
<key>NSUserTrackingUsageDescription</key>
<string>為了提供個性化廣告體驗，我們需要您的授權</string>
```

**✅ 這些配置已經完成**，不需要額外修改。

---

## 🧪 測試 AdMob 廣告

### 當前配置（測試階段）：

使用 **Google 官方測試廣告 ID**，特點：
- ✅ 不會產生真實收益
- ✅ 不會違反 AdMob 政策
- ✅ 可以無限次測試
- ✅ 顯示正常的測試廣告
- ✅ 所有廣告類型都可用

### 測試流程：

1. **啟動 APP**
   - 在模擬器或設備上運行
   - 登入帳號
   - 確保有網路連接

2. **測試獎勵廣告**（最重要）
   - 前往「任務」頁面
   - 點擊「觀看 30 秒廣告」
   - **會顯示真實的 AdMob 測試獎勵廣告**
   - 觀看完畢後獲得 5 代幣

3. **測試其他功能**
   - 簽到功能
   - 投票功能
   - 建立主題
   - Banner 廣告（如已啟用）

---

## 🔄 更新到正式 AdMob ID

當準備上線到 App Store 時：

### 步驟 1: 申請 AdMob 帳號

1. 前往：https://admob.google.com/
2. 註冊帳號
3. 通過審核（1-7 天）

### 步驟 2: 創建 APP 和廣告單元

在 AdMob 控制台：
1. 創建 iOS APP
2. 獲得 **App ID**（格式：`ca-app-pub-XXXXXXXXXX~YYYYYYYYYY`）
3. 創建廣告單元：
   - Banner: 橫幅廣告
   - Interstitial: 插頁廣告
   - Rewarded: 獎勵廣告
4. 獲得每個單元的 **Unit ID**（格式：`ca-app-pub-XXXXXXXXXX/ZZZZZZZZZZ`）

### 步驟 3: 更新配置文件

**檔案 1**: `ios/App/App/Info.plist`

```xml
<!-- 替換為您的實際 AdMob App ID -->
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-YOUR_ACTUAL_APP_ID~YOUR_ACTUAL_ID</string>
```

**檔案 2**: `src/lib/admob.ts`

```typescript
export const TEST_AD_IDS = {
  android: {
    banner: 'ca-app-pub-YOUR_APP_ID/YOUR_BANNER_ID',
    interstitial: 'ca-app-pub-YOUR_APP_ID/YOUR_INTERSTITIAL_ID',
    rewarded: 'ca-app-pub-YOUR_APP_ID/YOUR_REWARDED_ID',
  },
  ios: {
    banner: 'ca-app-pub-YOUR_APP_ID/YOUR_BANNER_ID',
    interstitial: 'ca-app-pub-YOUR_APP_ID/YOUR_INTERSTITIAL_ID',
    rewarded: 'ca-app-pub-YOUR_APP_ID/YOUR_REWARDED_ID',
  }
};
```

### 步驟 4: 重新建置

```bash
npm run build
npx cap sync ios
npx cap open ios
```

在 Xcode 中重新建置。

---

## 🎯 預期效果

### 當前狀態（測試 ID）：

| 功能 | Web 瀏覽器 | iOS APP |
|------|-----------|---------|
| **觀看廣告** | 模擬廣告（30秒倒計時） | ✅ 真實 AdMob 測試廣告 |
| **Banner 廣告** | 佔位符 | ✅ 真實橫幅廣告 |
| **插頁廣告** | 模擬 | ✅ 真實插頁廣告 |
| **所有功能** | ✅ 正常運作 | ✅ 正常運作 |

### 獎勵廣告體驗：

1. 點擊「觀看 30 秒廣告」
2. 彈出全屏 AdMob 測試獎勵廣告
3. 觀看完整廣告（約 30 秒）
4. 獲得 5 代幣
5. 代幣即時更新

---

## 📊 功能驗證清單

建置成功後，請測試以下功能：

- [ ] APP 啟動無錯誤
- [ ] 登入功能正常
- [ ] 觀看廣告顯示真實測試廣告
- [ ] 觀看完畢獲得 5 代幣
- [ ] 代幣餘額即時更新
- [ ] 每日簽到功能正常
- [ ] 投票功能正常
- [ ] 建立主題功能正常
- [ ] 刪除主題功能正常
- [ ] Banner 廣告顯示（如已啟用）
- [ ] 所有頁面載入正常

---

## 🐛 常見問題

### 問題 1: "Command 'pod' not found"

**解決方法**：
```bash
# 安裝 CocoaPods
sudo gem install cocoapods

# 如果安裝失敗，使用 Homebrew
brew install cocoapods
```

### 問題 2: "No such module 'Capacitor'"

**解決方法**：
```bash
cd ios/App
pod install
cd ../..
npx cap sync ios
```

### 問題 3: "Signing for 'App' requires a development team"

**解決方法**：
1. 打開 Xcode
2. 選擇 `App` target
3. `Signing & Capabilities` 標籤
4. 選擇或添加 Apple Developer 團隊

### 問題 4: AdMob 廣告不顯示

**解決方法**：
1. 確認網路連接正常
2. 檢查 Info.plist 中的 AdMob ID 是否正確
3. 檢查是否使用測試 ID（正式 ID 在審核前不會顯示）
4. 查看 Xcode Console 日誌

---

## 📝 重要提醒

### ⚠️ 上線前必做：

1. **申請 AdMob 正式帳號**
2. **獲取正式 App ID 和 Unit ID**
3. **更新配置文件**
4. **重新建置 Release 版本**
5. **測試正式廣告流程**
6. **遵守 AdMob 政策**（不得點擊自己的廣告）

### 📋 AdMob 政策檢查清單：

- [ ] 不提供虛假或誤導性的內容
- [ ] 不鼓勵用戶點擊廣告
- [ ] 不要點擊自己的廣告（會被封號）
- [ ] 確保 APP 有實際功能（不是純廣告）
- [ ] 遵循 App Store 審核指南

---

## 🎉 總結

**當前狀態**：✅ 完全準備就緒

- ✅ iOS 配置完成
- ✅ AdMob 測試廣告已配置
- ✅ 所有功能代碼完整
- ✅ 建置指南已準備

**下一步**：

1. 在 macOS 上執行 `npm run ios`
2. 在 Xcode 中編譯並運行
3. 測試 AdMob 廣告功能
4. 確認所有功能正常

**預期結果**：✅ 成功的 iOS APP，包含完整的 AdMob 測試廣告功能

---

## 📞 技術支援

如有問題，請檢查：
- `Android建置指南-完整版.md` - Android 參考指南
- `ADMOB_INTEGRATION_GUIDE.md` - AdMob 配置詳情
- Xcode Console 日誌
- iOS 模擬器日誌

**祝建置順利！** 🚀

