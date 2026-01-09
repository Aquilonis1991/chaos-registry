# LINE 登入 401 錯誤 - 最終解決方案

## ✅ 已完成的修復

### 1. 修改 `index.html` 使用 `fetch` POST 請求

已將 `index.html` 中的內聯腳本修改為使用 `fetch` POST 請求調用 Edge Function，而不是重定向到 Edge Function 的回調 URL。這樣可以避免 401 錯誤。

**修改前**：
```javascript
// 重定向到 Edge Function 回調 URL（會觸發 401 錯誤）
window.location.replace(edgeFunctionUrl.toString());
```

**修改後**：
```javascript
// 使用 fetch POST 請求調用 Edge Function（避免 401 錯誤）
fetch(edgeFunctionUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    code: code,
    state: state,
    error: error || null,
  }),
})
```

### 2. Edge Function 已支持 POST 請求

Edge Function 已經支持處理 POST 請求的回調，並且會自動重定向到前端應用。

### 3. 環境變數已更新

- `LINE_REDIRECT_URI` 已設置為前端應用 URL：`https://chaos-registry.vercel.app/auth/callback?provider=line`

---

## 🔍 問題分析

從日誌來看，執行時間 178ms 表示 Edge Function 確實執行了，但返回了 401 錯誤。這可能是因為：

1. **Supabase 路由層級攔截**：Supabase 路由層級可能在 Edge Function 代碼執行之前就檢查了授權，返回 401
2. **GET 請求被攔截**：LINE 服務器直接重定向到 Edge Function 的回調 URL（GET 請求），這會被 Supabase 路由層級攔截

**解決方案**：
- 修改 `index.html` 使用 `fetch` POST 請求調用 Edge Function，而不是重定向
- 這樣可以避免 Supabase 路由層級攔截 GET 請求

---

## 📋 驗證步驟

### 1. 確認 LINE Developer Console 設置

確認 LINE Developer Console 中的回調 URL 已正確修改：

- ✅ 應該設置為：`https://chaos-registry.vercel.app/auth/callback?provider=line`
- ❌ 不應該是：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`

### 2. 測試 LINE 登入流程

1. **清除瀏覽器快取和 Cookie**
2. **嘗試使用 LINE 登入**
3. **檢查流程**：
   - LINE 服務器重定向到前端應用（`/auth/callback?provider=line&code=...&state=...`）
   - `index.html` 中的內聯腳本檢測到 LINE 回調
   - 使用 `fetch` POST 請求調用 Edge Function
   - Edge Function 處理回調並返回 magic link
   - 前端重定向到 magic link
   - 登入成功

### 3. 檢查 Edge Function 日誌

在 Supabase Dashboard 中查看 Edge Function 日誌，確認是否有以下日誌：

- ✅ `Edge Function request received` - 表示請求到達了 Edge Function
- ✅ `Handling callback request` - 表示回調請求被處理
- ✅ `Generated magic link, redirecting` - 表示 magic link 已生成

---

## ⚠️ 重要提醒

1. **LINE Developer Console 回調 URL 必須修改**
   - 必須設置為前端應用 URL：`https://chaos-registry.vercel.app/auth/callback?provider=line`
   - 如果沒有修改，LINE 服務器會直接重定向到 Edge Function，導致 401 錯誤

2. **`index.html` 已修改為使用 `fetch` POST 請求**
   - 這樣可以避免 Supabase 路由層級攔截 GET 請求
   - 即使 LINE 服務器直接重定向到 Edge Function，`index.html` 也會使用 `fetch` POST 請求調用 Edge Function

3. **Edge Function 已支持 POST 請求**
   - Edge Function 已經支持處理 POST 請求的回調
   - 會自動重定向到前端應用

---

**修復完成時間**：2026-01-09
**Edge Function 版本**：38（已提前自動重定向邏輯）
**前端修改**：`index.html` 已修改為使用 `fetch` POST 請求
