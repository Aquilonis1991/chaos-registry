# X / Twitter Edge Function 環境變數設定完整指南

## 📋 需要設定的環境變數

1. **TWITTER_CLIENT_ID**：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
2. **TWITTER_CLIENT_SECRET**：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
3. **JWT_SECRET**：Supabase 的 JWT Secret（用於簽名 `state` 參數）

---

## 🔍 步驟 1：獲取 Supabase JWT Secret

### 方法 1：從 Supabase Dashboard 獲取

1. **前往 Supabase Dashboard**
   - 網址：https://app.supabase.com/
   - 選擇專案：`epyykzxxglkjombvozhr`

2. **導航到 Settings > API**
   - 在左側選單中點擊 **Settings**（齒輪圖標）
   - 點擊 **API** 標籤

3. **找到 JWT Secret**
   - 在 **Project API keys** 區域下方
   - 找到 **JWT Secret** 欄位
   - 點擊 **Reveal** 或 **Show** 按鈕顯示完整 Secret
   - **複製完整的 JWT Secret**（通常是一長串 Base64 編碼的字串）

### 方法 2：從 Supabase CLI 獲取

```bash
# 如果已安裝 Supabase CLI
supabase projects api-keys --project-ref epyykzxxglkjombvozhr
```

---

## ⚙️ 步驟 2：設定 Edge Function 環境變數

### 方法 1：使用 Supabase Dashboard（推薦）

1. **前往 Edge Functions**
   - 在 Supabase Dashboard 左側選單中
   - 點擊 **Edge Functions**

2. **選擇 twitter-auth Function**
   - 在函數列表中，找到並點擊 **twitter-auth**

3. **打開 Settings**
   - 點擊函數詳情頁面右上角的 **Settings** 按鈕（或齒輪圖標）

4. **添加環境變數**
   - 在 **Environment Variables** 區域
   - 點擊 **Add new variable** 或 **+** 按鈕
   - 依次添加以下三個環境變數：

   **變數 1：TWITTER_CLIENT_ID**
   - **Key**：`TWITTER_CLIENT_ID`
   - **Value**：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - 點擊 **Save**

   **變數 2：TWITTER_CLIENT_SECRET**
   - **Key**：`TWITTER_CLIENT_SECRET`
   - **Value**：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
   - 點擊 **Save**

   **變數 3：JWT_SECRET**
   - **Key**：`JWT_SECRET`
   - **Value**：貼上從步驟 1 獲取的 JWT Secret
   - 點擊 **Save**

5. **確認所有變數已添加**
   - 確認三個環境變數都已顯示在列表中
   - 確認值都正確無誤

---

### 方法 2：使用 Supabase CLI

```bash
# 設定環境變數
supabase secrets set TWITTER_CLIENT_ID=R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ --project-ref epyykzxxglkjombvozhr
supabase secrets set TWITTER_CLIENT_SECRET=rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG --project-ref epyykzxxglkjombvozhr
supabase secrets set JWT_SECRET=你的JWT_SECRET值 --project-ref epyykzxxglkjombvozhr

# 注意：JWT_SECRET 需要替換為實際的值
```

---

## 🚀 步驟 3：重新部署 Edge Function

### 方法 1：使用 Supabase Dashboard

1. **前往 Edge Functions**
   - 在 Supabase Dashboard 中，點擊 **Edge Functions**

2. **選擇 twitter-auth**
   - 在函數列表中，找到 **twitter-auth**

3. **重新部署**
   - 點擊函數詳情頁面右上角的 **Deploy** 或 **Redeploy** 按鈕
   - 等待部署完成（通常需要 1-2 分鐘）

### 方法 2：使用 Supabase CLI

```bash
# 確保已登入 Supabase CLI
supabase login

# 連結到專案
supabase link --project-ref epyykzxxglkjombvozhr

# 部署 twitter-auth Edge Function
supabase functions deploy twitter-auth
```

---

## ✅ 步驟 4：驗證設定

### 檢查環境變數

1. **在 Supabase Dashboard 中**
   - 前往 **Edge Functions > twitter-auth > Settings**
   - 確認三個環境變數都已正確設定
   - 確認值都正確無誤

### 測試 Edge Function

1. **檢查函數日誌**
   - 在 Supabase Dashboard 中，前往 **Edge Functions > twitter-auth**
   - 點擊 **Logs** 標籤
   - 嘗試使用 X (Twitter) 登入
   - 檢查日誌中是否有錯誤訊息

2. **常見錯誤**
   - 如果看到 `TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET must be set`：環境變數未正確設定
   - 如果看到 `JWT verification failed`：JWT_SECRET 不正確
   - 如果看到 `Invalid client id or web redirect url`：檢查 X Developer Portal 設定

---

## 🔧 步驟 5：確認 X Developer Portal 設定

請確認 X Developer Portal 中的設定：

1. **Callback URI**：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```

2. **Client ID**：
   ```
   R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ
   ```

3. **Client Secret**：
   ```
   rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG
   ```

---

## 📝 完整檢查清單

- [ ] 已從 Supabase Dashboard 獲取 JWT Secret
- [ ] 已在 Supabase Dashboard 中設定 `TWITTER_CLIENT_ID`
- [ ] 已在 Supabase Dashboard 中設定 `TWITTER_CLIENT_SECRET`
- [ ] 已在 Supabase Dashboard 中設定 `JWT_SECRET`
- [ ] 已重新部署 `twitter-auth` Edge Function
- [ ] 已確認 X Developer Portal 中的 Callback URI 正確
- [ ] 已測試 X (Twitter) 登入功能

---

## ⚠️ 注意事項

1. **JWT Secret 安全性**
   - JWT Secret 是敏感資訊，請勿分享或提交到 Git
   - 只在 Supabase Dashboard 的環境變數中設定

2. **環境變數更新**
   - 更新環境變數後，必須重新部署 Edge Function 才會生效

3. **多環境設定**
   - 如果有多個環境（開發、生產），請確保每個環境都正確設定

---

## 🐛 故障排除

### 問題 1：環境變數未生效

**解決方案**：
- 確認已重新部署 Edge Function
- 檢查環境變數名稱是否正確（大小寫敏感）
- 確認值沒有多餘的空格或換行

### 問題 2：JWT Secret 錯誤

**解決方案**：
- 重新從 Supabase Dashboard 獲取 JWT Secret
- 確認複製的是完整的 Secret（沒有截斷）
- 確認沒有多餘的空格

### 問題 3：Edge Function 部署失敗

**解決方案**：
- 檢查 Edge Function 代碼是否有語法錯誤
- 檢查 Supabase CLI 是否已正確登入
- 確認專案引用（project-ref）正確

---

**設定完成後，X (Twitter) 登入應該可以正常運作！**
