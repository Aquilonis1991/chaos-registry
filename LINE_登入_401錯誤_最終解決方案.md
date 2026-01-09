# LINE 登入 401 錯誤 - 最終解決方案

## ⚠️ 問題根源

從日誌可以看到：
- **POST 請求**到 `/functions/v1/line-auth` 返回 **200**（成功）
- **GET 請求**到 `/functions/v1/line-auth/callback` 返回 **401**（失敗）

**問題**：LINE 服務器直接重定向到 Edge Function 的回調 URL，被 Supabase 路由層級攔截（即使使用 `Deno.serve` 也無法跳過）。

## ✅ 解決方案

### 方案 1：修改 LINE Developer Console 回調 URL（推薦）

將 LINE 回調 URL 從 Edge Function 改為前端應用的 URL，讓前端處理回調並轉發到 Edge Function。

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

或者（如果使用本地開發）：
```
http://localhost:5173/auth/callback?provider=line
```

#### 步驟 3：更新 Edge Function 環境變數

在 Supabase Dashboard 中，更新 `line-auth` Edge Function 的環境變數：

1. 前往：https://app.supabase.com/
2. 選擇專案：`epyykzxxglkjombvozhr`
3. 導航到 **Edge Functions** > **line-auth** > **Settings**
4. 更新 `LINE_REDIRECT_URI` 環境變數為新的回調 URL：
   ```
   https://chaos-registry.vercel.app/auth/callback?provider=line
   ```

#### 步驟 4：測試

1. 清除瀏覽器快取和 Cookie
2. 嘗試使用 LINE 登入
3. 應該會重定向到前端應用的 `/auth/callback?provider=line`
4. 前端會自動使用 `fetch` POST 請求調用 Edge Function
5. Edge Function 會處理回調並返回 magic link

---

### 方案 2：使用 Supabase 內建的 LINE Provider（如果支持）

如果 Supabase 支持 LINE 作為內建 Provider，可以考慮使用它：

1. 前往 Supabase Dashboard
2. 導航到 **Authentication** > **Providers**
3. 查找 **LINE** Provider
4. 如果存在，啟用並配置

---

## 📋 已完成的代碼修改

### 1. 前端 `OAuthCallbackPage.tsx`

- ✅ 檢測 LINE 回調（通過 `provider=line` 參數或 state 格式判斷）
- ✅ 使用 `fetch` POST 請求調用 Edge Function（避免 GET 請求被攔截）
- ✅ 處理 Edge Function 返回的重定向（magic link）

### 2. Edge Function `line-auth/index.ts`

- ✅ 支持 POST 請求的回調處理（從 body 中讀取參數）
- ✅ 支持 GET 請求的回調處理（從 query 參數中讀取，作為備用）
- ✅ 使用 `Deno.serve` 跳過 Supabase 路由層級的授權檢查

---

## 🔧 技術細節

### 修復前的流程（會導致 401 錯誤）

```
LINE 服務器 → 直接重定向到 Edge Function
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback?code=...&state=...
↓
Supabase 路由層級攔截（檢查授權 header）
↓
401 Missing authorization header ❌
```

### 修復後的流程（正確）

```
LINE 服務器 → 重定向到前端應用
https://chaos-registry.vercel.app/auth/callback?provider=line&code=...&state=...
↓
前端 `OAuthCallbackPage` 檢測到 LINE 回調
↓
使用 fetch POST 請求調用 Edge Function
POST https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
Body: { code, state, error }
↓
Edge Function 處理回調（POST 請求不會被攔截）
↓
返回 magic link 重定向
↓
用戶登入成功 ✅
```

---

## ⚠️ 重要提醒

1. **必須修改 LINE Developer Console 中的回調 URL**
   - 這是解決 401 錯誤的關鍵步驟
   - 如果不修改，LINE 服務器仍會直接重定向到 Edge Function，導致 401 錯誤

2. **更新 Edge Function 環境變數**
   - 確保 `LINE_REDIRECT_URI` 與 LINE Developer Console 中的回調 URL 一致
   - 這用於驗證回調請求的合法性

3. **前端代碼已準備就緒**
   - `OAuthCallbackPage.tsx` 已修改為支持 LINE 回調
   - 會自動使用 `fetch` POST 請求調用 Edge Function

4. **Edge Function 已支持 POST 回調**
   - `line-auth` Edge Function 已更新為支持 POST 請求的回調處理
   - 可以從 body 中讀取 `code`、`state`、`error` 等參數

---

## 📝 檢查清單

- [ ] 修改 LINE Developer Console 中的回調 URL 為前端應用 URL
- [ ] 更新 Edge Function 環境變數 `LINE_REDIRECT_URI`
- [ ] 清除瀏覽器快取和 Cookie
- [ ] 測試 LINE 登入功能
- [ ] 檢查 Edge Function 日誌，確認 POST 請求成功處理

---

**修復完成時間**：2026-01-09
**Edge Function 版本**：最新（已支持 POST 回調）
