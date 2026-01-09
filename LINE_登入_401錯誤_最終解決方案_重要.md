# LINE 登入 401 錯誤 - 最終解決方案（重要）

## ⚠️ 問題分析

從日誌可以看到：
- **執行時間只有 170ms**，這非常短
- **GET 請求返回 401**，表示請求在到達 Edge Function 之前就被 Supabase 路由層級攔截

**關鍵問題**：即使使用 `Deno.serve`，Supabase 路由層級仍然會在 Edge Function 處理之前檢查授權 header，導致 401 錯誤。

---

## ✅ 解決方案

### 方案 1：修改 LINE Developer Console 回調 URL（必須執行）

這是**唯一可靠**的解決方案。必須將 LINE Developer Console 中的回調 URL 從 Edge Function 改為前端應用。

#### 步驟 1：前往 LINE Developer Console

1. 前往：https://developers.line.biz/console/
2. 選擇您的 LINE Login Channel
3. 導航到 **LINE Login** > **Callback URL**

#### 步驟 2：修改回調 URL

**當前設置**（會導致 401 錯誤）：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
```

**修改為**（前端應用 URL）：
```
https://chaos-registry.vercel.app/auth/callback?provider=line
```

#### 步驟 3：保存更改

點擊 **Save** 或 **Update** 按鈕保存更改。

---

### 方案 2：已完成的代碼修復（作為備用）

雖然已添加自動重定向邏輯，但如果 Supabase 路由層級在 Edge Function 處理之前就攔截請求，這個邏輯可能無法執行。

#### 已完成的修復

1. **Edge Function 自動重定向**
   - 當收到 GET 回調請求（沒有授權 header）時，自動重定向到前端應用
   - 但這可能無法執行，因為請求在到達 Edge Function 之前就被攔截

2. **前端 POST 請求處理**
   - `OAuthCallbackPage.tsx` 已修改為使用 `fetch` POST 請求調用 Edge Function
   - 這可以避免 GET 請求被攔截

3. **環境變數已更新**
   - `LINE_REDIRECT_URI` 已設置為前端應用 URL

---

## 🔧 為什麼必須修改 LINE Developer Console

### 問題根源

1. **Supabase 路由層級攔截**
   - 即使使用 `Deno.serve`，Supabase 路由層級仍然會檢查某些路徑的授權
   - GET 請求到 `/functions/v1/line-auth/callback` 會被攔截（401 錯誤）
   - 執行時間只有 170ms，表示請求在到達 Edge Function 之前就被攔截

2. **Edge Function 無法處理**
   - 如果請求在到達 Edge Function 之前就被攔截，Edge Function 的代碼無法執行
   - 自動重定向邏輯也無法執行

3. **POST 請求可以通過**
   - POST 請求不會被 Supabase 路由層級攔截
   - 這就是為什麼前端使用 POST 請求可以成功（200 狀態碼）

### 解決方案

**必須修改 LINE Developer Console 中的回調 URL**，讓 LINE 服務器重定向到前端應用，而不是直接重定向到 Edge Function。

---

## 📋 完整流程（修改後）

```
1. 用戶點擊 LINE 登入按鈕
↓
2. 前端調用 Edge Function（POST 請求）→ 成功（200）
↓
3. Edge Function 返回 LINE 授權 URL
↓
4. 用戶在 LINE 授權頁面授權
↓
5. LINE 服務器重定向到前端應用（不是 Edge Function）
https://chaos-registry.vercel.app/auth/callback?provider=line&code=...&state=...
↓
6. 前端 OAuthCallbackPage 檢測到 LINE 回調
↓
7. 使用 fetch POST 請求調用 Edge Function
POST https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
Body: { code, state, error }
↓
8. Edge Function 處理回調（POST 請求不會被攔截）→ 成功（200）
↓
9. 返回 magic link 重定向
↓
10. 用戶登入成功 ✅
```

---

## ⚠️ 重要提醒

1. **必須修改 LINE Developer Console**
   - 這是解決 401 錯誤的**唯一可靠**方法
   - 如果不修改，LINE 服務器仍會直接重定向到 Edge Function，導致 401 錯誤

2. **環境變數已更新**
   - `LINE_REDIRECT_URI` 已設置為前端應用 URL
   - Edge Function 會使用此 URL 進行驗證

3. **前端代碼已準備就緒**
   - `OAuthCallbackPage.tsx` 已修改為支持 LINE 回調
   - 會自動使用 `fetch` POST 請求調用 Edge Function

4. **Edge Function 已更新**
   - 支持 POST 回調處理
   - 添加了自動重定向邏輯（作為備用）

---

## 🧪 測試步驟

1. **修改 LINE Developer Console 中的回調 URL**（必須）
2. **清除瀏覽器快取和 Cookie**
3. **嘗試使用 LINE 登入**
4. **檢查流程**：
   - LINE 服務器應該重定向到前端應用（不是 Edge Function）
   - 前端應該使用 POST 請求調用 Edge Function
   - 登入應該成功

---

**修復完成時間**：2026-01-09
**必須執行的步驟**：修改 LINE Developer Console 中的回調 URL ⚠️
