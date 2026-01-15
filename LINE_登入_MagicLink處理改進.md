# LINE 登入 - Magic Link 處理改進

## ❌ 問題描述

**症狀**：
- 顯示錯誤訊息：「授權碼已被使用。如果尚未登入，請重新嘗試登入。」
- 但一直沒有確實登入

**原因分析**：
- 第一個請求成功生成了 magic link
- 但 magic link 在 App 環境中沒有被正確處理
- 導致用戶沒有登入

---

## ✅ 解決方案

### 改進 1：Edge Function 返回 hashed_token

在 `line-auth` Edge Function 中：
- 除了返回 `redirectUrl`（magic link），還返回 `hashedToken`
- `hashedToken` 可以用於直接驗證並創建 session，不需要依賴 magic link 重定向

```typescript
return new Response(
  JSON.stringify({ 
    redirectUrl: magicLink,
    hashedToken: hashedToken, // 用於直接驗證（App 環境）
  }),
  {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  }
)
```

### 改進 2：前端直接驗證 token

在 `OAuthCallbackHandler.tsx` 中：
- 在 App 環境中，如果有 `hashedToken`，直接使用 `verifyOtp` 驗證並創建 session
- 避免依賴 magic link 重定向（在 App 環境中可能不可靠）

```typescript
if (isNative() && data.hashedToken) {
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.hashedToken,
    type: 'email', // 使用 'email' 類型（Supabase 已棄用 'magiclink' 類型）
  });
  
  if (verifyData.session) {
    // Session 已設置，導航到首頁
    navigate('/home', { replace: true });
  }
}
```

---

## 🔧 修改內容

### Edge Function (`line-auth/index.ts`)

1. **返回 hashed_token**：
   - 從 `generateLink` 的結果中提取 `hashed_token`
   - 在 POST 響應中返回 `hashedToken`

### 前端 (`OAuthCallbackHandler.tsx`)

1. **直接驗證 token**：
   - 在 App 環境中，如果有 `hashedToken`，直接使用 `verifyOtp` 驗證
   - 如果驗證成功，直接導航到首頁
   - 如果驗證失敗，回退到打開 magic link

---

## 🎯 預期結果

完成改進後，應該能夠：
- ✅ 第一個請求成功處理用戶登入
- ✅ 在 App 環境中直接驗證 token 並創建 session
- ✅ 用戶成功登入，不再需要依賴 magic link 重定向
- ✅ 如果出現重複請求，仍然返回友好的錯誤訊息

---

## 📝 測試建議

1. **正常登入測試**：
   - 點擊 LINE 登入按鈕
   - 完成授權流程
   - 確認能夠成功登入（不再顯示錯誤訊息）

2. **重複請求測試**（可選）：
   - 快速多次點擊登入按鈕
   - 確認只有一次成功，其他返回友好錯誤
   - 確認即使有重複請求，用戶仍然能夠登入

---

## 💡 技術細節

### Magic Link vs Hashed Token

**Magic Link**：
- 需要用戶訪問 URL
- Supabase 驗證 token 並重定向
- 在 App 環境中可能不可靠

**Hashed Token**：
- 可以直接在前端驗證
- 不需要重定向
- 更適合 App 環境

### 為什麼使用 `type: 'email'`？

根據 Supabase 文檔：
- `magiclink` 類型已被棄用
- 應該使用 `email` 類型
- `verifyOtp` 支持 `token_hash` 參數

---

**更新日期**：2026-01-14  
**狀態**：已改進 magic link 處理，使用 hashed_token 直接驗證
