# 🚀 iOS 建置快速參考

> 一頁看完所有重要資訊

---

## ⚠️ 重要提示

**iOS 建置只能在 macOS 上執行！**

Windows/Linux 無法建置 iOS APP，需要：
- 使用 macOS 電腦
- 或使用雲端 macOS 服務（如 MacStadium、GitHub Actions）
- 或使用遠端 macOS 伺服器

---

## 📋 當前狀態

### ✅ 已就緒

| 項目 | 狀態 | 說明 |
|------|------|------|
| iOS 專案 | ✅ 已創建 | Capacitor iOS 已初始化 |
| AdMob 配置 | ✅ 完成 | 測試 ID 已配置 |
| Info.plist | ✅ 完成 | 所有權限已設置 |
| 代碼整合 | ✅ 完成 | Web + 原生都支援 |
| 建置腳本 | ✅ 完成 | npm run ios |
| 廣告功能 | ✅ 完成 | 獎勵、Banner、插頁 |

---

## 🎯 一鍵建置（macOS 專用）

### 首次建置

```bash
# 1. 安裝 iOS 依賴
cd ios/App
pod install
cd ../..

# 2. 建置並打開 Xcode
npm run ios
```

### 後續建置

```bash
# 直接建置
npm run ios
```

**這個命令會**：
1. 自動建置 React 應用
2. 同步到 iOS 專案
3. 打開 Xcode

在 Xcode：
- 選擇模擬器或設備
- `Product` → `Run` (⌘ + R)

---

## ⚙️ 前置需求檢查

必須安裝：

```bash
# 檢查 Node.js
node --version    # v18+ ✓

# 檢查 CocoaPods
pod --version     # 安裝：sudo gem install cocoapods

# 檢查 Xcode
xcodebuild -version
```

---

## 🧪 測試廣告

### iOS 模擬器/設備
- 點擊觀看廣告 → **顯示真實 AdMob 測試獎勵廣告**
- 觀看完畢獲得 5 代幣
- 每日限制 10 次

### Web 瀏覽器（開發）
- 點擊觀看廣告 → 顯示模擬廣告（30秒倒計時）

---

## ⚠️ 測試 ID vs 正式 ID

### 當前使用（測試）

```xml
<!-- ios/App/App/Info.plist -->
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-3940256099942544~1458002511</string>
```

特點：
- ✅ 不會產生收益
- ✅ 可以無限測試
- ✅ 顯示測試廣告
- ✅ 不會違反政策

### 上線前（正式）

1. 申請 AdMob 帳號
2. 替換 Info.plist 中的 ID
3. 替換 src/lib/admob.ts 中的 ID
4. 重新建置

---

## 🔍 驗證清單

建置成功後測試：

- [ ] APP 啟動正常
- [ ] 登入功能
- [ ] 觀看廣告（應該顯示真實測試廣告）
- [ ] 獲得 5 代幣
- [ ] 代幣顯示更新
- [ ] 每日簽到
- [ ] 投票
- [ ] 建立主題

---

## 🆘 常見錯誤

### "Command 'pod' not found"
```bash
sudo gem install cocoapods
# 或
brew install cocoapods
```

### "No such module 'Capacitor'"
```bash
cd ios/App
pod install
cd ../..
npm run build
npx cap sync ios
```

### "Signing requires development team"
- Xcode → `App` target → `Signing & Capabilities`
- 選擇開發團隊

### AdMob 廣告不顯示
1. 檢查網路
2. 確認使用測試 ID
3. 查看 Xcode Console

---

## 📞 詳細文檔

- `iOS建置指南-完整版.md` - 完整建置步驟
- `ADMOB_INTEGRATION_GUIDE.md` - AdMob 配置
- `BUILD_APK_GUIDE.md` - Android 參考

---

## ✅ 開始建置

```bash
# 在 macOS 上執行

# 1. 安裝依賴
cd ios/App && pod install && cd ../..

# 2. 建置並打開 Xcode
npm run ios

# 3. 在 Xcode 中運行
# Product → Run (⌘ + R)

# 4. 測試廣告功能
# 任務頁面 → 觀看廣告 → 應該顯示真實測試廣告
```

**預期結果**：✅ 成功的 iOS APP，包含完整的 AdMob 測試廣告功能

---

## 🌍 跨平台建置對比

| 平台 | 系統需求 | 建置命令 | 廣告體驗 |
|------|---------|---------|---------|
| **Web** | 任何系統 | `npm run dev` | 模擬廣告（30秒） |
| **Android** | Windows/Mac/Linux | `npm run android` | ✅ 真實測試廣告 |
| **iOS** | **僅 macOS** | `npm run ios` | ✅ 真實測試廣告 |

---

**提醒**：如果沒有 macOS，可以考慮：
- 租用 macOS 雲端服務
- 使用 MacStadium、MacinCloud
- 或先專注 Android 版本

祝好運！🎉

