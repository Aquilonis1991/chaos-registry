# 重新部署 watch-ad Edge Function 詳細步驟

## 📋 概述

由於我們優化了 `watch-ad` Edge Function 的配置讀取邏輯（從 4 次串行查詢改為 1 次並行查詢），需要重新部署到 Supabase 才能生效。

---

## 🚀 方法 1：使用 Supabase CLI（推薦）

### 前置條件

1. **確認已安裝 Supabase CLI**
   ```powershell
   supabase --version
   ```
   
   如果未安裝，請執行：
   ```powershell
   npm install -g supabase
   ```

2. **確認已登入 Supabase**
   ```powershell
   supabase login
   ```
   
   如果未登入，會自動打開瀏覽器要求登入。

### 步驟 1：進入專案目錄

```powershell
cd C:\Users\USER\Documents\Mywork\votechaos-main
```

### 步驟 2：確認 Supabase 專案連接

**方法 A：使用 config.toml 中的 project_id**
```powershell
supabase link --project-ref idfqzcsxvuxperxfieam
```

**方法 B：從 Supabase URL 獲取 project-ref**
1. 查看您的 Supabase URL（例如：`https://epyykzxxglkjombvozhr.supabase.co`）
2. 提取 project-ref：`epyykzxxglkjombvozhr`
3. 執行：
```powershell
supabase link --project-ref epyykzxxglkjombvozhr
```

**方法 C：從 Supabase Dashboard 獲取**
1. 前往 https://supabase.com/dashboard
2. 選擇您的專案
3. 點擊 **Settings** → **General**
4. 找到 **Reference ID**（這就是 project-ref）

**注意**：如果已經連接過，會顯示 "Project already linked"，可以跳過此步驟。

### 步驟 3：部署 watch-ad Edge Function

```powershell
supabase functions deploy watch-ad
```

**預期輸出**：
```
Deploying function watch-ad...
Function watch-ad deployed successfully
```

### 步驟 4：驗證部署

1. 前往 Supabase Dashboard：https://supabase.com/dashboard/project/epyykzxxglkjombvozhr
2. 左側選單 → **Edge Functions**
3. 找到 `watch-ad` 函數
4. 確認 **Last updated** 時間是最新的

---

## 🌐 方法 2：使用 Supabase Dashboard（手動部署）

如果 CLI 方法遇到問題，可以使用 Dashboard 手動部署。

### 步驟 1：打開 Supabase Dashboard

1. 前往：https://supabase.com/dashboard
2. 選擇您的專案（或直接訪問：https://supabase.com/dashboard/project/idfqzcsxvuxperxfieam）
3. 左側選單 → **Edge Functions**

### 步驟 2：找到 watch-ad 函數

1. 在函數列表中找到 `watch-ad`
2. 點擊函數名稱進入編輯頁面

### 步驟 3：更新函數代碼

1. 打開本地文件：`votechaos-main\supabase\functions\watch-ad\index.ts`
2. **全選並複製**整個文件內容（Ctrl+A, Ctrl+C）
3. 在 Dashboard 的編輯器中：
   - **全選並刪除**舊代碼（Ctrl+A, Delete）
   - **貼上**新代碼（Ctrl+V）

### 步驟 4：部署

1. 點擊右上角的 **Deploy** 按鈕
2. 等待部署完成（約 10-30 秒）
3. 確認顯示 "Function deployed successfully"

### 步驟 5：驗證

1. 查看函數的 **Last updated** 時間，確認是最新的
2. 可以點擊 **Test** 按鈕測試函數（可選）

---

## 🔍 驗證部署是否成功

### 方法 1：檢查 Dashboard

1. 前往 Supabase Dashboard → Edge Functions → watch-ad
2. 查看 **Last updated** 時間
3. 確認時間是剛才部署的時間

### 方法 2：測試函數

在 Dashboard 中：
1. 點擊 **Test** 按鈕
2. 選擇 **POST** 方法
3. 在 **Headers** 中添加：
   ```
   Authorization: Bearer <您的 ANON KEY>
   ```
4. 點擊 **Run** 執行測試
5. 查看響應，確認函數正常運行

### 方法 3：在應用中測試

1. 重新構建並同步 Android 專案：
   ```powershell
   npm run build
   npx cap sync android
   ```
2. 在 Android Studio 中重新運行應用
3. 嘗試觀看廣告
4. 檢查日誌，確認 Edge Function 調用成功

---

## ⚠️ 常見問題

### 問題 1：`supabase: command not found`

**解決方案**：
```powershell
npm install -g supabase
```

### 問題 2：`Project not linked`

**解決方案**：
```powershell
supabase link --project-ref epyykzxxglkjombvozhr
```

### 問題 3：`Authentication failed`

**解決方案**：
```powershell
supabase login
```
然後在瀏覽器中完成登入。

### 問題 4：部署失敗

**解決方案**：
1. 檢查網絡連接
2. 確認 Supabase 專案狀態正常
3. 嘗試使用 Dashboard 手動部署（方法 2）

### 問題 5：函數部署後仍然使用舊代碼

**解決方案**：
1. 等待 1-2 分鐘（CDN 緩存）
2. 清除瀏覽器緩存
3. 重新啟動應用

---

## 📝 部署後的檢查清單

完成部署後，請確認：

- [ ] Edge Function 已成功部署（Dashboard 顯示最新時間）
- [ ] 函數代碼已更新（配置讀取邏輯已優化）
- [ ] 應用已重新構建並同步
- [ ] Android Studio 已刷新專案
- [ ] 測試觀看廣告功能
- [ ] 確認響應時間改善（從 ~35 秒減少到 ~3-5 秒）
- [ ] 確認配置讀取正確（使用後台設置的 `mission_watch_ad_reward`）

---

## 🎯 預期效果

部署成功後，您應該看到：

1. **配置讀取優化**：
   - Edge Function 內部配置讀取從 4 次查詢減少到 1 次
   - 配置讀取時間從 ~400ms 減少到 ~100ms

2. **響應時間改善**：
   - 第一次觀看：從 ~7 秒減少到 ~3-5 秒
   - 後續觀看：從 ~35 秒減少到 ~3-5 秒
   - 改善：減少 80-90%

3. **配置讀取正確**：
   - 使用後台設置的 `mission_watch_ad_reward` 值
   - 不再顯示 "配置 ad_reward_amount 不存在" 的警告

---

## 📞 需要幫助？

如果遇到問題，請：

1. 檢查 Supabase Dashboard 中的函數日誌
2. 查看 Android Studio 的 Logcat 輸出
3. 確認網絡連接正常
4. 確認 Supabase 專案狀態正常

---

## 🔗 相關文檔

- [部署Edge Functions指南.md](./部署Edge Functions指南.md)
- [性能優化修復說明.md](./性能優化修復說明.md)
- [刷新Android專案流程.md](./刷新Android專案流程.md)

