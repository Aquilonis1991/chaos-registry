# X (Twitter) 設定 JWT_SECRET 立即修復步驟

## 🔑 JWT Secret

您提供的 JWT Secret：
```
W5GXYqKqbMV4JFCz0ma0cU85//cKkeOlB7ELigyETEb677bLYQjlxTJcPoEuTwQ0Rq7xddIqarlugtX9fzgdSw==
```

---

## 📋 設定步驟

### 方法 1：使用 Supabase Dashboard（推薦）

1. **登入 Supabase Dashboard**：
   - 前往 [https://app.supabase.com/](https://app.supabase.com/)
   - 選擇專案：`epyykzxxglkjombvozhr`

2. **導航到 Edge Functions**：
   - 在左側選單中，點擊 **Edge Functions**
   - 找到 **twitter-auth** 函數
   - 點擊 **twitter-auth** 進入函數詳情頁

3. **設定環境變數**：
   - 在函數詳情頁中，找到 **Settings** 或 **Environment Variables** 區塊
   - 點擊 **Add Environment Variable** 或 **Edit Environment Variables**
   - 添加以下環境變數：
     - **Key**: `JWT_SECRET`
     - **Value**: `W5GXYqKqbMV4JFCz0ma0cU85//cKkeOlB7ELigyETEb677bLYQjlxTJcPoEuTwQ0Rq7xddIqarlugtX9fzgdSw==`
   - 點擊 **Save** 或 **Update**

4. **確認設定**：
   - 確認 `JWT_SECRET` 環境變數已出現在環境變數列表中
   - 確認值完全正確（沒有多餘的空格或換行）

---

### 方法 2：使用 Supabase CLI

如果您使用 Supabase CLI 管理環境變數：

```bash
cd votechaos-main

# 設定環境變數
npx supabase secrets set JWT_SECRET=W5GXYqKqbMV4JFCz0ma0cU85//cKkeOlB7ELigyETEb677bLYQjlxTJcPoEuTwQ0Rq7xddIqarlugtX9fzgdSw==

# 重新部署 Edge Function
npx supabase functions deploy twitter-auth
```

---

## ✅ 驗證設定

### 步驟 1：檢查環境變數

1. 在 Supabase Dashboard 中，確認 `JWT_SECRET` 環境變數已設定
2. 確認值完全正確（沒有多餘的空格或換行）

---

### 步驟 2：重新部署 Edge Function

```bash
cd votechaos-main
npx supabase functions deploy twitter-auth
```

---

### 步驟 3：測試 X (Twitter) 登入

1. **清除瀏覽器快取和 Cookie**
2. **嘗試使用 X (Twitter) 登入**
3. **檢查 Supabase Auth Logs**：
   - 在 Supabase Dashboard 中，導航到 **Logs** > **Auth Logs**
   - 確認沒有 `token signature is invalid` 錯誤
   - 確認登入流程正常完成

---

## 🔍 檢查 Edge Function 代碼

Edge Function 代碼應該已經正確設定：

```typescript
// 優先使用 JWT_SECRET 環境變數
const JWT_SECRET = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET')
const STATE_SECRET = JWT_SECRET || SERVICE_ROLE_KEY.substring(0, 32)
```

這表示：
- 優先使用 `JWT_SECRET` 環境變數
- 如果沒有設定，回退到 `SUPABASE_JWT_SECRET`
- 如果都沒有，使用 `SERVICE_ROLE_KEY` 的前 32 個字符

---

## ⚠️ 注意事項

1. **JWT Secret 安全性**：
   - JWT Secret 是敏感資訊，請勿分享或提交到 Git
   - 確保只在 Supabase Dashboard 或環境變數中設定

2. **環境變數名稱**：
   - 必須是 `JWT_SECRET`（大寫）
   - 不能是 `jwt_secret` 或 `Jwt_Secret`

3. **值格式**：
   - 值必須完全匹配，不能有多餘的空格或換行
   - 確保複製時沒有遺漏任何字符

---

## 🐛 常見問題

### 問題 1：仍然出現 `token signature is invalid` 錯誤

**可能原因**：
- 環境變數未正確設定
- 環境變數名稱錯誤
- 值格式不正確（有多餘的空格或換行）

**解決方案**：
1. 確認環境變數名稱是 `JWT_SECRET`（大寫）
2. 確認值完全正確（沒有多餘的空格或換行）
3. 重新部署 Edge Function
4. 清除瀏覽器快取並重新測試

---

### 問題 2：找不到 Environment Variables 設定頁面

**解決方案**：
- 在 Supabase Dashboard 中，導航到 **Edge Functions** > **twitter-auth**
- 點擊 **Settings** 標籤
- 或使用 Supabase CLI：`npx supabase secrets set JWT_SECRET=...`

---

### 問題 3：環境變數已設定但 Edge Function 仍無法使用

**解決方案**：
1. 確認已重新部署 Edge Function
2. 檢查 Edge Function 日誌，確認環境變數是否被正確讀取
3. 確認 Edge Function 代碼正確使用 `Deno.env.get('JWT_SECRET')`

---

## 📚 相關文件

- `X_Twitter_停用內建Provider後仍被攔截_解決方案.md` - 完整問題分析
- `X_Twitter_state_簽名驗證失敗_解決方案.md` - JWT 簽名驗證說明
- `supabase/functions/twitter-auth/index.ts` - Edge Function 實作

---

**下一步**：請按照上述步驟設定 `JWT_SECRET` 環境變數，然後重新部署 Edge Function 並測試 X (Twitter) 登入。
