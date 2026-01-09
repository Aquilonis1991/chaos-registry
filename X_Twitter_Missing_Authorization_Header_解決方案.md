# X (Twitter) 登入 "Missing authorization header" 錯誤解決方案

## ⚠️ 問題

**錯誤訊息**：`Missing authorization header`

**發生位置**：X (Twitter) 登入回調處理

**原因**：
- Edge Function 的回調端點可能被 Supabase 路由層級檢查攔截
- 回調請求來自 X (Twitter) 服務器，不包含 authorization header
- 即使使用了 `Deno.serve`，某些情況下 Supabase 仍可能檢查 authorization header

---

## 🔍 問題分析

### 當前流程

1. **用戶點擊 X 登入按鈕**
2. **跳轉到 X 授權頁面**
3. **用戶授權後，X 回調到標準回調 URL**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback?code=...&state=...`
4. **前端 `OAuthCallbackPage` 檢測到 X Provider 的回調**
5. **前端轉發到 Edge Function**：`/functions/v1/twitter-auth/callback?code=...&state=...`
6. **Edge Function 處理回調時出現 "Missing authorization header" 錯誤**

---

## ✅ 解決方案

### 方案 1：檢查 Edge Function 配置（優先）

**檢查 Supabase Dashboard 中的 Edge Function 配置**：

1. **登入 Supabase Dashboard**
2. **進入 Edge Functions**：
   - https://supabase.com/dashboard/project/epyykzxxglkjombvozhr/functions
3. **找到 `twitter-auth` 函數**
4. **檢查配置**：
   - 確認函數是否正確部署
   - 確認環境變數已設定
   - 檢查是否有任何授權限制設定

---

### 方案 2：修改 Edge Function 處理邏輯

**問題**：回調請求可能被 Supabase 路由層級攔截

**解決方案**：確保 Edge Function 正確處理無授權的回調請求

**檢查點**：
1. Edge Function 使用 `Deno.serve` 而不是 `serve`（已確認 ✅）
2. 回調端點跳過來源驗證（已確認 ✅）
3. 但可能仍需要處理 Supabase 路由層級的檢查

---

### 方案 3：使用不同的回調處理方式

**如果 Supabase 路由層級強制要求 authorization header**，可以考慮：

1. **直接在前端處理回調**：
   - 不轉發到 Edge Function
   - 在前端直接調用 Edge Function 的 API 端點（使用 fetch）
   - 傳遞必要的參數

2. **使用 POST 請求而不是 GET**：
   - 將回調參數作為 POST body 發送
   - 可能可以繞過某些檢查

---

## 🔧 立即修復步驟

### 步驟 1：檢查 Edge Function 日誌

1. **登入 Supabase Dashboard**
2. **進入 Edge Functions** → **twitter-auth** → **Logs**
3. **查看最近的錯誤日誌**
4. **確認錯誤發生的確切位置**

---

### 步驟 2：修改前端回調處理（如果方案 3 適用）

**檔案**：`src/pages/OAuthCallbackPage.tsx`

**修改**：使用 fetch 調用 Edge Function，而不是直接重定向

```typescript
// 如果檢測到 X Provider 的回調
if ((code && state && !hashParams.get('access_token')) || provider === 'twitter' || (error && code && state)) {
  console.log('[OAuthCallbackPage] Detected X (Twitter) OAuth callback, calling Edge Function');
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    toast.error('登入失敗', {
      description: '缺少 VITE_SUPABASE_URL'
    });
    navigate('/auth', { replace: true });
    return;
  }
  
  // 使用 fetch 調用 Edge Function
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/twitter-auth/callback?code=${code}&state=${state}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      // 處理成功響應
      const data = await response.json();
      // 如果 Edge Function 返回重定向 URL，則重定向
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        // 否則等待 session 建立
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate('/home', { replace: true });
        }
      }
    } else {
      throw new Error('Edge Function 調用失敗');
    }
  } catch (error) {
    console.error('[OAuthCallbackPage] Error calling Edge Function:', error);
    toast.error('登入失敗', {
      description: '無法處理登入回調'
    });
    navigate('/auth', { replace: true });
  }
  return;
}
```

---

### 步驟 3：檢查 Edge Function 是否需要修改

**如果錯誤來自 Supabase 路由層級**，可能需要：

1. **確認 Edge Function 使用 `Deno.serve`**（已確認 ✅）
2. **檢查是否有其他配置需要調整**
3. **考慮使用 Supabase 的 Webhook 功能**

---

## 📋 檢查清單

### Edge Function 配置
- [ ] Edge Function 已正確部署
- [ ] 環境變數已設定
- [ ] 檢查 Edge Function 日誌中的錯誤詳情

### 前端處理
- [ ] 檢查 `OAuthCallbackPage` 的轉發邏輯
- [ ] 確認轉發 URL 正確
- [ ] 考慮使用 fetch 而不是直接重定向

### 測試
- [ ] 測試 X 登入流程
- [ ] 檢查瀏覽器控制台錯誤
- [ ] 檢查 Edge Function 日誌
- [ ] 確認錯誤發生的確切位置

---

## 🔍 調試步驟

### 1. 檢查瀏覽器控制台

打開瀏覽器開發者工具（F12），查看：
- Console 中的錯誤訊息
- Network 標籤中的請求詳情
- 確認轉發到 Edge Function 的請求狀態

### 2. 檢查 Edge Function 日誌

在 Supabase Dashboard 中查看：
- Edge Functions → twitter-auth → Logs
- 查看最近的錯誤日誌
- 確認錯誤發生的確切位置和原因

### 3. 測試 Edge Function 端點

使用 curl 或 Postman 測試 Edge Function 端點：
```bash
curl "https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback?code=test&state=test"
```

---

## 📚 相關文件

- `X_Twitter_標準回調URL_處理方案.md` - 標準回調 URL 處理方案
- `supabase/functions/twitter-auth/index.ts` - Edge Function 實作
- `src/pages/OAuthCallbackPage.tsx` - OAuth 回調處理頁面

---

**下一步**：請先檢查 Edge Function 日誌，確認錯誤發生的確切位置和原因。
