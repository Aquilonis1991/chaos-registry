# 📱 Android 建置與部署完整指南

> **專案**: VoteChaos  
> **平台**: Android  
> **適用於**: 開發、測試、生產環境

---

## ✅ 目前配置狀態

### 已完成的配置：

- ✅ **Capacitor 已初始化** (`com.votechaos.app`)
- ✅ **AdMob 依賴已安裝** (`@capacitor-community/admob@6.0.0`)
- ✅ **Google Play Services Ads 已配置** (22.6.0)
- ✅ **AdMob 測試 ID 已配置**
- ✅ **網路權限已添加**
- ✅ **AndroidManifest.xml 已配置**
- ✅ **AdMob Service 代碼已完整** (`src/lib/admob.ts`)
- ✅ **測試廣告功能已實現** (獎勵廣告、Banner 廣告、插頁廣告)

---

## 🚀 快速建置流程

### 一鍵建置命令：

```powershell
# 在專案根目錄執行
npm run android
```

**這個命令會自動：**
1. 建置 React 應用 (`npm run build`)
2. 同步到 Android 專案 (`npx cap sync android`)
3. 打開 Android Studio (`npx cap open android`)

---

## 📋 詳細步驟（首次建置）

### 步驟 1: 檢查環境

```powershell
# 檢查 Node.js
node --version    # 應該顯示 v18.x 或更高

# 檢查 Capacitor CLI
npx cap --version

# 檢查 Android Studio（選擇性）
adb version
```

### 步驟 2: 安裝依賴（如需要）

```powershell
npm install
```

### 步驟 3: 建置並同步

```powershell
# 建置 React 應用到 dist 資料夾
npm run build

# 同步到 Android 專案
npx cap sync android

# 打開 Android Studio
npx cap open android
```

### 步驟 4: 在 Android Studio 中建置

#### 方法 A: 圖形界面建置

1. 等待 Android Studio 索引完成（首次 1-5 分鐘）
2. 頂部選單：`Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
3. 等待建置完成（首次 5-10 分鐘，後續 1-3 分鐘）
4. 點擊通知中的「locate」按鈕，查看 APK 位置

#### 方法 B: Gradle 命令建置

在 Android Studio 的 Terminal 中執行：

```bash
cd android
.\gradlew assembleDebug
```

#### 方法 C: 直接運行到設備/模擬器

1. 連接 Android 設備或啟動模擬器
2. 頂部選單：`Run` → `Run 'app'`
3. APP 會自動安裝並啟動

---

## 📂 APK 位置

建置完成後，APK 檔案位於：

```
android/app/build/outputs/apk/debug/app-debug.apk
```

**檔案大小**: 約 30-50 MB  
**用途**: 開發測試、內部測試

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

1. **安裝 APK**
   - 傳輸 `app-debug.apk` 到 Android 設備
   - 點擊安裝（允許未知來源）
   
2. **啟動 APP**
   - 登入帳號
   - 確保有網路連接

3. **測試獎勵廣告**（最重要）
   - 前往「任務」頁面
   - 點擊「觀看 30 秒廣告」
   - **會顯示真實的 AdMob 測試獎勵廣告**
   - 觀看完畢後獲得 5 代幣

4. **測試其他功能**
   - 簽到功能
   - 投票功能
   - 建立主題
   - Banner 廣告（如已啟用）

---

## ⚠️ AndroidManifest.xml 配置確認

### 當前配置（測試環境）：

```xml
<!-- AdMob App ID（測試用）-->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713"/>
```

### 權限確認：

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

**✅ 這些配置已經完成**，不需要額外修改。

---

## 🔄 更新到正式 AdMob ID

當準備上線到 Google Play 時：

### 步驟 1: 申請 AdMob 帳號

1. 前往：https://admob.google.com/
2. 註冊帳號
3. 通過審核（1-7 天）

### 步驟 2: 創建 APP 和廣告單元

在 AdMob 控制台：
1. 創建 Android APP
2. 獲得 **App ID**（格式：`ca-app-pub-XXXXXXXXXX~YYYYYYYYYY`）
3. 創建廣告單元：
   - Banner: 橫幅廣告
   - Interstitial: 插頁廣告
   - Rewarded: 獎勵廣告
4. 獲得每個單元的 **Unit ID**（格式：`ca-app-pub-XXXXXXXXXX/ZZZZZZZZZZ`）

### 步驟 3: 更新配置文件

**檔案 1**: `android/app/src/main/AndroidManifest.xml`

```xml
<!-- 替換為您的實際 AdMob App ID -->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-YOUR_ACTUAL_APP_ID~YOUR_ACTUAL_ID"/>
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

```powershell
npm run build
npx cap sync android
npx cap open android
```

在 Android Studio 中重新建置 APK。

---

## 🎯 預期效果

### 當前狀態（測試 ID）：

| 功能 | Web 瀏覽器 | Android APP |
|------|-----------|------------|
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

### 問題 1: "Gradle sync failed"

**解決方法**：
```powershell
# 清理並重新同步
cd android
.\gradlew clean
cd ..
npx cap sync android
```

### 問題 2: "SDK location not found"

**解決方法**：
1. 打開 Android Studio
2. `File` → `Project Structure`
3. 設置 Android SDK 路徑

### 問題 3: "Metro bundler" 相關錯誤

**解決方法**：
```powershell
# 清理並重新建置
npm run build -- --emptyOutDir
npx cap sync android
```

### 問題 4: AdMob 廣告不顯示

**解決方法**：
1. 確認網路連接正常
2. 檢查 AndroidManifest.xml 中的 AdMob ID 是否正確
3. 檢查是否使用測試 ID（正式 ID 在審核前不會顯示）
4. 查看 logcat 日誌錯誤

---

## 📝 重要提醒

### ⚠️ 上線前必做：

1. **申請 AdMob 正式帳號**
2. **獲取正式 App ID 和 Unit ID**
3. **更新配置文件**
4. **重新建置 Release APK**
5. **測試正式廣告流程**
6. **遵守 AdMob 政策**（不得點擊自己的廣告）

### 📋 AdMob 政策檢查清單：

- [ ] 不提供虛假或誤導性的內容
- [ ] 不鼓勵用戶點擊廣告
- [ ] 不要點擊自己的廣告（會被封號）
- [ ] 確保 APP 有實際功能（不是純廣告）
- [ ] 遵循 Google Play 政策

---

## 🎉 總結

**當前狀態**：✅ 完全準備就緒

- ✅ Android 配置完成
- ✅ AdMob 測試廣告已配置
- ✅ 所有功能代碼完整
- ✅ 建置指南已準備
- ✅ 只需要執行建置命令

**下一步**：

1. 執行 `npm run android` 開始建置
2. 在 Android Studio 中編譯 APK
3. 安裝到設備測試
4. 確認廣告功能正常

**預期結果**：✅ 成功的 Android APP，包含完整的 AdMob 測試廣告功能

---

## 📞 技術支援

如有問題，請檢查：
- `BUILD_APK_GUIDE.md` - 詳細建置步驟
- `ADMOB_INTEGRATION_GUIDE.md` - AdMob 配置詳情
- Android Studio Console 日誌
- logcat 輸出

**祝建置順利！** 🚀

