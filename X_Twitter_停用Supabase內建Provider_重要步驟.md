# X / Twitter 停用 Supabase 內建 Provider - 重要步驟

## ⚠️ 關鍵問題

錯誤日誌顯示 Supabase 的內建處理邏輯仍然在使用 **OAuth 1.0a** 攔截回調：
- `oauth_signature_method="HMAC-SHA1"` → OAuth 1.0a
- `oauth_version="1.0"` → OAuth 1.0

但 X (Twitter) 現在只支援 **OAuth 2.0**。

---

## ✅ 解決方案：停用 Supabase 內建的 X/Twitter Provider

### 步驟 1：前往 Supabase Dashboard

1. **登入 Supabase Dashboard**
   - 網址：https://app.supabase.com/
   - 選擇專案：`epyykzxxglkjombvozhr`

2. **導航到 Authentication > Providers**
   - 在左側選單中點擊 **Authentication**
   - 點擊 **Providers** 標籤

3. **找到 X / Twitter (OAuth 2.0) Provider**
   - 在 Provider 列表中，找到 **X / Twitter (OAuth 2.0)**
   - 或找到 **Twitter**（舊版名稱）

4. **停用 Provider**
   - 找到 **X / Twitter (OAuth 2.0)** 的開關
   - **確保開關是關閉狀態**（Off/Disabled）
   - 如果已啟用，請點擊開關將其**關閉**

5. **確認停用**
   - 確認開關顯示為關閉狀態
   - 確認 Client ID 和 Client Secret 欄位已清空或隱藏

---

## 🔍 驗證步驟

### 檢查 1：確認 Provider 已停用

1. 在 Supabase Dashboard 中
2. 前往 **Authentication > Providers**
3. 確認 **X / Twitter (OAuth 2.0)** 的開關是**關閉**狀態

### 檢查 2：測試登入

1. 嘗試使用 X (Twitter) 登入
2. 檢查 Supabase Auth Logs
3. **不應該**再看到 `oauth_signature_method="HMAC-SHA1"` 的錯誤
4. **應該**看到回調被轉發到 Edge Function

---

## 📋 完整檢查清單

- [ ] 已前往 Supabase Dashboard > Authentication > Providers
- [ ] 已找到 X / Twitter (OAuth 2.0) Provider
- [ ] 已確認 Provider 開關是**關閉**狀態
- [ ] 已測試 X (Twitter) 登入功能
- [ ] 已確認不再出現 OAuth 1.0a 錯誤

---

## ⚠️ 重要提醒

1. **必須停用 Supabase 內建的 X/Twitter Provider**
   - 即使我們使用 Edge Function，如果內建 Provider 啟用，Supabase 仍會嘗試處理回調
   - 內建 Provider 使用 OAuth 1.0a，與 X (Twitter) 的 OAuth 2.0 不兼容

2. **Edge Function 已正確設定**
   - `twitter-auth` Edge Function 已部署
   - 環境變數已正確設定
   - 代碼已正確修改

3. **前端代碼已正確修改**
   - `AuthPage.tsx` 使用 `handleEdgeSocialLogin('twitter')`
   - `OAuthCallbackPage.tsx` 會立即轉發回調
   - `index.html` 中的內聯腳本會提前檢測

---

## 🐛 如果仍然出現錯誤

### 問題 1：仍然看到 OAuth 1.0a 錯誤

**解決方案**：
- 確認 Supabase Dashboard 中的 X/Twitter Provider 已**完全停用**
- 清除瀏覽器快取和 Cookie
- 重新測試登入

### 問題 2：回調沒有轉發到 Edge Function

**解決方案**：
- 檢查瀏覽器 Console 是否有錯誤
- 檢查 `index.html` 中的內聯腳本是否正確執行
- 檢查 `OAuthCallbackPage.tsx` 的邏輯是否正確

---

**關鍵步驟：必須在 Supabase Dashboard 中停用 X/Twitter Provider！**
