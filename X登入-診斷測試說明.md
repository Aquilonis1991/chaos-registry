# X (Twitter) 登入 - 診斷測試說明

> **建立日期**：2025-01-29  
> **狀態**：已修改代碼，暫時不指定 `redirectTo` 參數進行測試

---

## 🔧 已完成的修改

### 代碼變更

已修改 `src/pages/AuthPage.tsx`，暫時**不指定 `redirectTo` 參數**，讓 Supabase 使用預設值。

**目的**：確認問題是否與 `redirectTo` 參數的驗證有關。

---

## 🧪 測試步驟

### 步驟 1：同步到 Android

1. **已重新建置前端** ✅
2. **已同步到 Android 專案** ✅

### 步驟 2：在 Android Studio 中測試

1. **運行應用程式**（在模擬器或實體設備上）
2. **打開 Logcat**（過濾 `com.votechaos.app`）
3. **點擊 Twitter 登入按鈕**

### 步驟 3：觀察行為

#### 成功情況 ✅

1. **瀏覽器打開**
2. **顯示 X 授權頁面**（不是 Supabase 錯誤頁面）
3. **點擊「授權應用程式」**
4. **瀏覽器關閉，應用程式恢復**
5. **顯示「登入成功！」提示**

**如果成功**：
- 問題可能是 `redirectTo` 參數的驗證
- 需要檢查 Supabase 的 Redirect URLs 設定或 Site URL 設定

#### 失敗情況 ❌

如果仍然顯示 `{"error":"請求的路徑無效"}`：

- 問題可能是 Provider 配置
- 需要檢查 Provider 狀態和憑證
- 或 Supabase Site URL 設定

---

## 📋 測試結果分析

### 如果成功（顯示 X 授權頁面）

**下一步**：

1. **檢查 Supabase Site URL**：
   - 進入 **Settings → Authentication**
   - 確認 **Site URL** 設定為：`https://chaos-registry.vercel.app`
   - 或留空

2. **檢查 Redirect URLs 格式**：
   - 進入 **Authentication → URL Configuration**
   - 確認格式完全正確（沒有多餘空格或斜線）

3. **重新添加 `redirectTo` 參數**：
   - 修改代碼，重新指定 `redirectTo`
   - 測試是否成功

### 如果仍然失敗

**下一步**：

1. **檢查 Supabase Provider 狀態**：
   - 進入 **Authentication → Providers → X (Twitter)**
   - 確認開關真的啟用（綠色）
   - 嘗試重新啟用

2. **檢查 Supabase Site URL**：
   - 進入 **Settings → Authentication**
   - 確認 **Site URL** 設定

3. **查看 Supabase Authentication Logs**：
   - 進入 **Authentication → Logs**
   - 查看詳細的錯誤訊息

---

## 📝 需要記錄的資訊

請記錄以下資訊：

1. **測試時間**：__________
2. **測試結果**：
   - [ ] 成功：顯示 X 授權頁面
   - [ ] 失敗：仍然顯示 Supabase 錯誤頁面

3. **如果成功**：
   - 是否顯示 X 授權頁面？：__________
   - 點擊「授權」後的行為：__________

4. **如果失敗**：
   - 錯誤訊息：__________
   - 瀏覽器中的 URL：__________
   - Logcat 輸出：__________

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X 登入-初始階段錯誤分析](./X登入-初始階段錯誤分析.md)
- [X 登入-Supabase錯誤解決](./X登入-Supabase錯誤解決.md)

---

**最後更新**：2025-01-29



