# X (Twitter) 登入流程完整檢查

## 流程圖

```
1. 用戶點擊 X (Twitter) 登入按鈕
   ↓
2. AuthPage.tsx: handleEdgeSocialLogin('twitter')
   ↓
3. 調用 Edge Function: twitter-auth (POST, platform='app')
   ↓
4. Edge Function 生成授權 URL
   ↓
5. 前端重定向到 Twitter 授權頁面 (外部瀏覽器)
   ↓
6. 用戶在外部瀏覽器中授權
   ↓
7. Twitter 重定向到 Supabase 回調: /auth/v1/callback?code=...&state=...
   ↓
8. Supabase 路由層攔截，轉發到 Edge Function callback
   ↓
9. Edge Function 處理回調，生成 magic link
   ↓
10. Edge Function 重定向到 magic link
    ↓
11. Magic link 驗證後重定向到: ${FRONTEND_URL}/auth/callback?platform=app#access_token=...&refresh_token=...&type=magiclink
    ↓
12. 外部瀏覽器中打開這個 URL
    ↓
13. index.html 的內聯腳本檢查並重定向到 Deep Link: votechaos://auth/callback#access_token=...&refresh_token=...&type=magiclink
    ↓
14. Android 系統處理 Deep Link，打開 APP
    ↓
15. MainActivity.java 的 shouldOverrideUrlLoading 處理 Deep Link
    ↓
16. app-lifecycle.ts 監聽 appUrlOpen 事件
    ↓
17. OAuthCallbackHandler.tsx 處理 Deep Link 回調
    ↓
18. 設置 session，登入成功
```

## 關鍵問題點

### 問題 1: Magic Link 回調在外部瀏覽器中打開
- **位置**: 步驟 11-12
- **問題**: Magic link 驗證後重定向到前端 URL，在外部瀏覽器中打開
- **解決方案**: 已在 index.html 中添加處理邏輯，檢查並重定向到 Deep Link

### 問題 2: Deep Link 處理
- **位置**: 步驟 13-15
- **問題**: Deep Link 需要正確觸發 Android Intent
- **解決方案**: MainActivity.java 中的 shouldOverrideUrlLoading 應該已委託給 Capacitor

### 問題 3: APP 內回調處理
- **位置**: 步驟 16-18
- **問題**: APP 需要正確處理 Deep Link 並設置 session
- **解決方案**: app-lifecycle.ts 和 OAuthCallbackHandler.tsx 需要正確監聽和處理

## 需要檢查的代碼點

1. **AuthPage.tsx** - handleEdgeSocialLogin 函數
2. **twitter-auth/index.ts** - Edge Function 的 callback 處理
3. **index.html** - magic link 回調處理（內聯腳本）
4. **OAuthCallbackPage.tsx** - React 組件的回調處理
5. **MainActivity.java** - Deep Link 處理
6. **app-lifecycle.ts** - appUrlOpen 事件監聽
7. **OAuthCallbackHandler.tsx** - Deep Link 回調處理
