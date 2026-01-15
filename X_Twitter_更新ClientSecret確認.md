# X (Twitter) 更新 Client Secret 確認

## ✅ 新的 Client Secret 已記錄

**新的 Client Secret**：`as_J0ApwA9soAqWKg9Jb2P24qu8aIq79JttDL9IdDo2vcDSPre`

---

## 📋 更新 Supabase Dashboard 步驟

### 步驟 1：更新 Client Secret

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
3. 進入 **Authentication** → **Providers**
4. 找到 **X / Twitter (OAuth 2.0)**
5. **更新 Client Secret**：
   - 清除現有的 Client Secret 欄位
   - 貼上新的 Client Secret：`as_J0ApwA9soAqWKg9Jb2P24qu8aIq79JttDL9IdDo2vcDSPre`
   - **確認沒有多餘的空格或換行**

### 步驟 2：確認其他設定

確認以下設定都正確：
- ✅ **Client ID**：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`（不需要更改）
- ✅ **開關狀態**：**ON（綠色/啟用）**
- ✅ **"Allow users without an email"**：已勾選

### 步驟 3：儲存設定

1. 點擊 **Save** 按鈕
2. **等待 20-30 秒**（讓設定完全同步到後端）
3. 確認看到成功訊息或確認已儲存

### 步驟 4：驗證設定

1. **重新整理瀏覽器頁面**（按 F5 或 Ctrl+R）
2. 確認：
   - ✅ 開關仍然是 **ON（綠色）**
   - ✅ Client ID 欄位有內容：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - ✅ Client Secret 欄位有內容（顯示為 `••••••••`）
   - ✅ "Allow users without an email" 已勾選

---

## 🧪 測試登入

完成更新後：

1. **完全關閉 APP**（如果正在運行）
2. **重新啟動 APP**
3. 點擊 X (Twitter) 登入按鈕
4. **預期結果**：
   - ✅ 應該跳轉到 X 授權頁面
   - ❌ 不應該出現 "provider is not enabled" 錯誤

---

## 📋 當前設定摘要

### Supabase Dashboard
- ✅ **開關**：ON（綠色/啟用）
- ✅ **Client ID**：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
- ✅ **Client Secret**：`as_J0ApwA9soAqWKg9Jb2P24qu8aIq79JttDL9IdDo2vcDSPre`（新）
- ✅ **"Allow users without an email"**：已勾選

### X Developer Portal
- ✅ **Callback URI**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- ✅ **Type of App**：Web App, Automated App or Bot
- ✅ **App permissions**：Read

### 代碼
- ✅ **Provider 名稱**：`'twitter'`
- ✅ **函數調用**：`handleSocialLogin('twitter')`

---

## ⚠️ 重要提醒

1. **舊的 Client Secret 已失效**：
   - 舊的 Client Secret：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG` 已失效
   - 確保 Supabase Dashboard 中已更新為新的值

2. **只會顯示一次**：
   - 新的 Client Secret 已記錄，請妥善保管
   - 如果忘記，需要再次重新生成

3. **等待設定生效**：
   - 更新後請等待 20-30 秒讓設定同步到後端
   - 重新整理頁面確認設定已保存

---

## 🆘 如果問題仍然存在

如果更新 Client Secret 後問題仍然存在，請：

1. **檢查 Supabase Dashboard 日誌**：
   - Authentication → Logs
   - 查看是否有新的錯誤訊息

2. **確認憑證格式**：
   - 確認 Client Secret 沒有多餘的空格或換行
   - 確認值完全一致：`as_J0ApwA9soAqWKg9Jb2P24qu8aIq79JttDL9IdDo2vcDSPre`

3. **執行強制重新啟用流程**：
   - 關閉開關 → 等待 15 秒 → 開啟開關 → 等待 20-30 秒

4. **聯繫 Supabase 支援**：
   - 提供專案 ID：`epyykzxxglkjombvozhr`
   - 提供錯誤訊息
   - 說明已重新生成並更新 Client Secret 但仍失敗

---

**更新日期**：2026-01-13  
**狀態**：等待 Supabase Dashboard 更新和測試結果
