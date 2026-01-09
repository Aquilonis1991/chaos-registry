# LINE 登入環境變數已更新

## ✅ 已完成的更新

### Edge Function 環境變數

**`LINE_REDIRECT_URI`** 已更新為：
```
https://chaos-registry.vercel.app/auth/callback?provider=line
```

### 驗證

使用 Supabase CLI 確認環境變數已更新：
```bash
supabase secrets list --project-ref epyykzxxglkjombvozhr
```

`LINE_REDIRECT_URI` 的 digest 已改變，表示環境變數已成功更新。

---

## 📋 下一步操作

### 必須執行的步驟：修改 LINE Developer Console 回調 URL

1. **前往 LINE Developer Console**
   - 網址：https://developers.line.biz/console/
   - 選擇您的 LINE Login Channel
   - 導航到 **LINE Login** > **Callback URL**

2. **修改回調 URL**
   - **當前設置**（會導致 401 錯誤）：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
     ```
   
   - **修改為**（前端應用 URL）：
     ```
     https://chaos-registry.vercel.app/auth/callback?provider=line
     ```

3. **保存更改**

---

## 🔧 技術細節

### 環境變數的作用

`LINE_REDIRECT_URI` 在 Edge Function 中用於：
1. **驗證回調請求的合法性**：確保回調 URL 與 LINE Developer Console 中設置的一致
2. **交換 access token**：在 LINE OAuth 流程中，使用此 URL 作為 `redirect_uri` 參數

### 修復後的流程

```
LINE 服務器 → 重定向到前端應用
https://chaos-registry.vercel.app/auth/callback?provider=line&code=...&state=...
↓
前端 OAuthCallbackPage 檢測到 LINE 回調
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

1. **環境變數已更新**：Edge Function 現在會使用新的回調 URL 進行驗證
2. **必須修改 LINE Developer Console**：如果不修改，LINE 服務器仍會直接重定向到 Edge Function，導致 401 錯誤
3. **兩者必須一致**：LINE Developer Console 中的回調 URL 和 Edge Function 環境變數 `LINE_REDIRECT_URI` 必須完全一致

---

**更新完成時間**：2026-01-09
**環境變數狀態**：已更新 ✅
