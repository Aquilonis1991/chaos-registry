# ✅ VoteChaos APP 設置檢查清單

> 按照此清單逐步完成，即可成功建置 APP

---

## 📋 環境準備（首次設置）

### ✅ Windows 開發 Android APP

- [ ] 安裝 Node.js 18+
  - 下載：https://nodejs.org/
  - 執行：`node --version` 驗證

- [ ] 安裝 Java JDK 17
  - 下載：https://www.oracle.com/java/technologies/downloads/
  - 設置 `JAVA_HOME` 環境變數

- [ ] 安裝 Android Studio
  - 下載：https://developer.android.com/studio
  - 安裝 Android SDK（API 34）
  - 創建模擬器（建議 Pixel 6）

### ✅ macOS 開發 iOS APP（選配）

- [ ] 安裝 Xcode 14+
- [ ] 安裝 CocoaPods: `sudo gem install cocoapods`
- [ ] 註冊 Apple Developer Account（USD $99/年）

---

## 📝 專案設置

### Step 1: 安裝依賴

```powershell
npm install
```

**驗證**：
- [ ] 無錯誤訊息
- [ ] `node_modules/` 資料夾已創建
- [ ] Capacitor 套件已安裝

---

### Step 2: 配置環境變數

**已完成** ✅：`.env.local` 已創建

**驗證**：
```powershell
Get-Content .env.local
```

應該看到：
- [ ] `VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...`

---

### Step 3: 執行資料庫遷移

**參考**：`QUICK_SQL_MIGRATION.md`

- [ ] 登入 Supabase Dashboard
- [ ] 執行所有遷移 SQL
- [ ] 驗證表格已創建
- [ ] 驗證函數已創建
- [ ] 查看示範公告（3個）

---

### Step 4: 建置 Web 應用

```powershell
npm run build
```

**驗證**：
- [ ] 建置成功（無錯誤）
- [ ] `dist/` 資料夾已創建
- [ ] `dist/index.html` 存在
- [ ] `dist/assets/` 資料夾有檔案

---

## 📱 Android APP 建置

### Step 5: 添加 Android 平台

```powershell
npx cap add android
```

**驗證**：
- [ ] `android/` 資料夾已創建
- [ ] 無錯誤訊息

---

### Step 6: 同步代碼到 Android

```powershell
npx cap sync android
```

**驗證**：
- [ ] 同步成功
- [ ] 無錯誤訊息

---

### Step 7: 打開 Android Studio

```powershell
npx cap open android
```

**首次打開時**（耐心等待）：
- [ ] Gradle 同步（3-10分鐘）
- [ ] 下載依賴
- [ ] 索引建置

**驗證**：
- [ ] Android Studio 成功打開專案
- [ ] 無 Gradle 錯誤
- [ ] 可以看到 `app` 模組

---

### Step 8: 運行 APP

在 Android Studio：

1. **選擇設備**：
   - [ ] 實體手機（已開啟 USB 偵錯）
   - [ ] 或模擬器（Pixel 6 推薦）

2. **點擊 Run ▶️**：
   - [ ] 等待建置（首次約 2-5 分鐘）
   - [ ] APP 自動安裝
   - [ ] APP 自動啟動

3. **驗證功能**：
   - [ ] APP 正常啟動
   - [ ] 看到啟動畫面
   - [ ] 首頁顯示（公告+主題）
   - [ ] 可以註冊/登入
   - [ ] 可以瀏覽主題
   - [ ] 可以投票
   - [ ] 可以創建主題

---

## 🍎 iOS APP 建置（僅 macOS）

### Step 9: 添加 iOS 平台

```bash
npx cap add ios
```

---

### Step 10: 安裝 CocoaPods

```bash
cd ios/App
pod install
cd ../..
```

---

### Step 11: 打開 Xcode

```bash
npx cap open ios
```

---

### Step 12: 配置並運行

在 Xcode：

1. **設置團隊**：
   - [ ] 選擇開發團隊
   - [ ] Bundle ID: `com.votechaos.app`

2. **選擇模擬器**：
   - [ ] iPhone 14 或更新

3. **點擊 Run ▶️**：
   - [ ] 建置成功
   - [ ] APP 啟動

---

## 🧪 功能測試清單

### 基本功能：
- [ ] 啟動無白屏
- [ ] 公告輪播顯示
- [ ] 主題列表載入
- [ ] 註冊新帳號
- [ ] 登入功能
- [ ] 匿名瀏覽

### 投票功能：
- [ ] 查看主題詳情
- [ ] 選擇投票選項
- [ ] 免費投票（每日一次）
- [ ] 代幣投票
- [ ] 投票後即時更新
- [ ] 檢舉主題

### 主題創建：
- [ ] 填寫主題資訊
- [ ] 選擇標籤
- [ ] 添加自定義標籤
- [ ] 選擇曝光方案
- [ ] 計算代幣消耗
- [ ] 成功創建主題

### 歷史紀錄：
- [ ] 查看投票歷史
- [ ] 查看發起紀錄
- [ ] 查看代幣紀錄
- [ ] 點擊跳轉正常

### 後台管理：
- [ ] 訪問後台（管理員）
- [ ] 公告管理
- [ ] 檢舉管理
- [ ] 主題審核
- [ ] 系統配置

### 原生功能：
- [ ] 返回按鈕正常（Android）
- [ ] 狀態欄樣式正確
- [ ] 觸覺反饋（按鈕點擊震動）
- [ ] 前景/背景切換正常

---

## 🐛 問題排查

### ❌ 建置失敗

```powershell
# 清除並重新建置
rm -rf dist
npm run build
npx cap sync android
```

### ❌ APP 白屏

1. 檢查 Logcat（Android）或 Console（iOS）
2. 確認 `.env.local` 存在
3. 確認 Supabase 連接正常
4. 重新建置並同步

### ❌ Gradle 錯誤

1. 在 Android Studio: File > Invalidate Caches > Restart
2. 刪除 `android/.gradle/` 資料夾
3. 重新同步 Gradle

### ❌ 無法連接 Supabase

1. 檢查網路連接
2. 確認 API Key 正確
3. 查看 Supabase Dashboard 狀態

---

## 📊 進度追蹤

### 環境準備：
- [ ] Node.js 已安裝
- [ ] Android Studio 已安裝
- [ ] JDK 已安裝
- [ ] 模擬器已創建

### 專案設置：
- [ ] 依賴已安裝
- [ ] 環境變數已配置
- [ ] 資料庫已遷移
- [ ] Web 建置成功

### Android APP：
- [ ] Android 平台已添加
- [ ] 代碼已同步
- [ ] Android Studio 可正常打開
- [ ] APP 可成功運行

### iOS APP（選配）：
- [ ] iOS 平台已添加
- [ ] CocoaPods 已安裝
- [ ] Xcode 可正常打開
- [ ] APP 可成功運行

### 功能測試：
- [ ] 所有核心功能正常
- [ ] 無崩潰
- [ ] 性能良好
- [ ] UI 顯示正確

---

## 🎯 目標狀態

完成所有檢查項目後，您將擁有：

✅ **開發環境** - 完全配置好的開發環境  
✅ **Android APP** - 可在 Android 設備運行  
✅ **iOS APP** - 可在 iOS 設備運行（如有 macOS）  
✅ **測試完成** - 所有功能驗證通過  
✅ **準備發布** - 可以開始準備上架素材  

---

## ⏰ 預估時間

| 階段 | 首次 | 之後 |
|------|------|------|
| 環境安裝 | 30-60 分鐘 | - |
| 專案設置 | 5-10 分鐘 | 1 分鐘 |
| Android 建置 | 10-20 分鐘 | 2-5 分鐘 |
| iOS 建置 | 15-30 分鐘 | 3-5 分鐘 |
| **總計** | **1-2 小時** | **5-10 分鐘** |

---

## 🎉 完成慶祝！

當您完成所有項目：

1. 🎊 恭喜您！VoteChaos 現在是一個 APP！
2. 📱 在手機上打開您自己開發的 APP
3. 🚀 開始規劃上架計劃
4. 💡 思考下一步功能

**您做到了！** 🎉

