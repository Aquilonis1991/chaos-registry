# 🚀 Android 建置快速參考

> 一頁看完所有重要資訊

---

## 📋 當前狀態

### ✅ 已就緒

| 項目 | 狀態 | 說明 |
|------|------|------|
| AdMob 配置 | ✅ 完成 | 測試 ID 已配置 |
| Android 配置 | ✅ 完成 | Manifest 已設置 |
| 代碼整合 | ✅ 完成 | Web + 原生都支援 |
| 建置腳本 | ✅ 完成 | npm run android |
| 廣告功能 | ✅ 完成 | 獎勵、Banner、插頁 |

---

## 🎯 一鍵建置

```powershell
npm run android
```

**這個命令會**：
1. 自動建置 React 應用
2. 同步到 Android 專案
3. 打開 Android Studio

然後在 Android Studio：
- `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
- 等待完成後點擊「locate」查看 APK

---

## 📂 APK 位置

```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🧪 測試廣告

### Web 瀏覽器（開發中）
- 點擊觀看廣告 → 顯示模擬廣告（30秒倒計時）
- 自動完成並發放代幣

### Android APP（建置後）
- 點擊觀看廣告 → **顯示真實 AdMob 測試獎勵廣告**
- 觀看完畢獲得 5 代幣
- 每日限制 10 次

---

## ⚠️ 測試 ID vs 正式 ID

### 當前使用（測試）

```xml
<!-- AndroidManifest.xml -->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713"/>
```

特點：
- ✅ 不會產生收益
- ✅ 可以無限測試
- ✅ 顯示測試廣告
- ✅ 不會違反政策

### 上線前（正式）

需要更新到實際 AdMob ID：
1. 申請 AdMob 帳號
2. 創建 APP 和廣告單元
3. 替換 AndroidManifest.xml 中的 ID
4. 替換 src/lib/admob.ts 中的 ID
5. 重新建置

---

## 🔍 驗證清單

建置成功後測試：

- [ ] APP 啟動正常
- [ ] 登入功能
- [ ] 觀看廣告（最重要！應該顯示真實測試廣告）
- [ ] 獲得 5 代幣
- [ ] 代幣顯示更新
- [ ] 每日簽到
- [ ] 投票
- [ ] 建立主題

---

## 🆘 常見錯誤

### "Gradle sync failed"
```powershell
cd android
.\gradlew clean
cd ..
npm run build
npx cap sync android
```

### AdMob 廣告不顯示
1. 檢查網路
2. 確認使用測試 ID
3. 查看 Android Studio logcat

---

## 📞 詳細文檔

- `Android建置指南-完整版.md` - 完整建置步驟
- `BUILD_APK_GUIDE.md` - APK 建置詳情
- `ADMOB_INTEGRATION_GUIDE.md` - AdMob 配置詳情

---

## ✅ 開始建置

```powershell
# 1. 建置並打開 Android Studio
npm run android

# 2. 在 Android Studio 中建置 APK
# 選擇：Build → Build APK(s)

# 3. 安裝到設備測試
# 傳輸 app-debug.apk 到手機並安裝

# 4. 測試廣告功能
# 任務頁面 → 觀看廣告 → 應該顯示真實測試廣告
```

**預期結果**：✅ 成功的 Android APP，包含完整的 AdMob 測試廣告功能

祝好運！🎉

