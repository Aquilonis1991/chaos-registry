# X (Twitter) 登入深度除錯指南

> **建立日期**：2025-01-29  
> **錯誤訊息**：`{"error":"請求的路徑無效"}`  
> **前提**：X Developer Portal 和 Supabase 基本設定都已確認正確

---

## 🔍 深度檢查項目

### 1. Provider 名稱問題

#### 問題：Supabase 可能使用不同的 provider 名稱

**檢查方法**：

1. **檢查 Supabase 支援的 Provider 名稱**：
   - 在 Supabase Dashboard → Authentication → Providers
   - 查看實際顯示的 Provider 名稱
   - 可能是 **「X」**、**「Twitter」** 或 **「X (Twitter)」**

2. **測試不同的 provider 名稱**：

   修改 `src/pages/AuthPage.tsx` 中的 provider 名稱：

   ```typescript
   // 嘗試 1：使用 'x' 而不是 'twitter'
   onClick={() => handleSocialLogin('x')}
   
   // 嘗試 2：使用 'twitter'（當前使用）
   onClick={() => handleSocialLogin('twitter')}
   ```

3. **檢查 Supabase 實際支援的 provider**：

   在瀏覽器控制台執行：
   ```javascript
   // 檢查 Supabase 支援的 providers
   const { data, error } = await supabase.auth.getSession();
   console.log('Supabase auth config:', supabase.auth);
   ```

---

### 2. Supabase URL Configuration 問題

#### 問題：Deep Link 可能未在 Supabase 中註冊

**檢查步驟**：

1. **進入 Supabase Dashboard**：
   - Authentication → URL Configuration
   - 或 Settings → Authentication → URL Configuration

2. **檢查 Redirect URLs**：
   - 確認是否有以下 URL：
     - `votechaos://auth/callback`（App 版 Deep Link）
     - `https://chaos-registry.vercel.app/home`（Web 版）
     - `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`（Supabase 回調）

3. **如果缺少 Deep Link**：
   - 點擊 **「Add URL」** 或 **「+」**
   - 添加：`votechaos://auth/callback`
   - 點擊 **Save**

---

### 3. 環境變數檢查

#### 問題：Supabase URL 或 Key 配置錯誤

**檢查步驟**：

1. **檢查環境變數檔案**：
   - 確認 `.env.local` 或 `.env` 檔案存在
   - 確認內容正確：

   ```env
   VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=您的_ANON_KEY
   ```

2. **在 App 中檢查實際使用的值**：

   在 `src/pages/AuthPage.tsx` 中添加調試代碼：

   ```typescript
   const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord' | 'line' | 'twitter') => {
     // 添加調試資訊
     console.log('[Twitter Login] Provider:', provider);
     console.log('[Twitter Login] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
     console.log('[Twitter Login] Is Native:', isNative());
     console.log('[Twitter Login] Redirect URL:', isNative() ? 'votechaos://auth/callback' : `${publicSiteUrl}/home`);
     
     // ... 原有代碼
   }
   ```

3. **檢查 Supabase Client 初始化**：

   確認 `src/integrations/supabase/client.ts` 中的 URL 正確：
   ```typescript
   const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
   // 應該是：https://epyykzxxglkjombvozhr.supabase.co
   ```

---

### 4. 網路請求檢查

#### 問題：實際發送的 API 請求路徑錯誤

**檢查方法**：

1. **在 Android Studio Logcat 中查看**：
   - 過濾關鍵字：`supabase`、`oauth`、`twitter`
   - 查看實際發送的 HTTP 請求
   - 確認請求 URL 是否正確

2. **預期的請求 URL 格式**：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/authorize?provider=twitter&...
   ```

3. **如果 URL 不正確**：
   - 檢查 `VITE_SUPABASE_URL` 環境變數
   - 確認沒有多餘的斜線或路徑

---

### 5. Supabase Provider 實際狀態檢查

#### 問題：Provider 可能未正確啟用

**檢查步驟**：

1. **使用 Supabase Management API 檢查**：

   在瀏覽器控制台執行（需要 Access Token）：
   ```javascript
   // 獲取 Provider 配置
   const response = await fetch(
     'https://api.supabase.com/v1/projects/epyykzxxglkjombvozhr/auth/providers',
     {
       headers: {
         'Authorization': `Bearer YOUR_ACCESS_TOKEN`,
         'Content-Type': 'application/json'
       }
     }
   );
   const providers = await response.json();
   console.log('Available providers:', providers);
   ```

2. **檢查 Supabase Dashboard 中的實際狀態**：
   - 進入 Authentication → Providers
   - 截圖保存當前狀態
   - 確認 X Provider 的實際配置

---

### 6. Provider 類型檢查

#### 問題：Supabase 可能不支援 Twitter/X 作為標準 Provider

**檢查方法**：

1. **查看 Supabase 官方文件**：
   - 確認 Supabase 是否支援 X (Twitter) Provider
   - 檢查是否有特殊設定要求

2. **檢查其他 Provider 是否正常**：
   - 測試 Google 登入是否正常
   - 如果 Google 正常，問題可能特定於 X Provider
   - 如果所有 Provider 都有問題，可能是 Supabase 配置問題

---

### 7. 錯誤處理改進

#### 添加更詳細的錯誤日誌

修改 `src/pages/AuthPage.tsx`：

```typescript
const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord' | 'line' | 'twitter') => {
  if (provider === 'line') {
    return handleLineLogin()
  }

  try {
    const redirectUrl = isNative() 
      ? 'votechaos://auth/callback'
      : `${publicSiteUrl}/home`;
    
    console.log('[OAuth] Starting OAuth flow:', {
      provider,
      redirectUrl,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      isNative: isNative()
    });
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    console.log('[OAuth] Response:', { data, error });

    if (error) {
      console.error('[OAuth] Error details:', {
        message: error.message,
        status: error.status,
        name: error.name,
        fullError: error
      });
      
      const providerNames: Record<string, string> = {
        'google': 'Google',
        'apple': 'Apple',
        'discord': 'Discord',
        'line': 'LINE',
        'twitter': 'Twitter'
      };
      const providerName = providerNames[provider] || provider;
      const socialLoginErrorTemplate = getText('auth_social_login_error', '{{provider}}登入失敗');
      toast.error(socialLoginErrorTemplate.replace('{{provider}}', providerName));
    } else if (data) {
      console.log('[OAuth] OAuth URL:', data.url);
    }
  } catch (error) {
    console.error('[OAuth] Exception:', error);
    toast.error(getText('auth_login_error', '登入失敗，請稍後再試'));
  }
};
```

---

### 8. 替代方案：使用自訂 Edge Function

#### 如果 Supabase 原生不支援 X Provider

類似 LINE 登入，可以創建自訂 Edge Function：

1. **創建 Edge Function**：
   - `supabase/functions/x-auth/index.ts`
   - 處理 X OAuth 流程

2. **前端調用 Edge Function**：
   ```typescript
   const handleXLogin = async () => {
     const { data, error } = await supabase.functions.invoke('x-auth/auth', {
       method: 'GET',
     });
     // ... 處理回調
   };
   ```

---

## 🔧 快速測試步驟

### 測試 1：檢查 Provider 名稱

1. 修改 `AuthPage.tsx`，嘗試使用 `'x'` 而不是 `'twitter'`
2. 重新建置並測試
3. 如果仍然失敗，改回 `'twitter'`

### 測試 2：檢查 Supabase URL Configuration

1. 進入 Supabase Dashboard → Authentication → URL Configuration
2. 確認 `votechaos://auth/callback` 已添加
3. 如果沒有，添加並儲存

### 測試 3：檢查環境變數

1. 確認 `.env.local` 檔案存在
2. 確認 `VITE_SUPABASE_URL` 正確
3. 重新建置應用程式

### 測試 4：查看詳細錯誤

1. 添加上述的調試代碼
2. 在 Android Studio Logcat 中查看詳細日誌
3. 確認實際發送的請求 URL

---

## 📝 檢查清單

- [ ] Provider 名稱測試（嘗試 'x' 和 'twitter'）
- [ ] Supabase URL Configuration 中已添加 Deep Link
- [ ] 環境變數正確設定
- [ ] Supabase Client URL 正確
- [ ] 添加了詳細的錯誤日誌
- [ ] 檢查了實際的網路請求
- [ ] 測試了其他 Provider（如 Google）是否正常
- [ ] 查看了 Supabase Dashboard 中的實際配置

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X 登入錯誤除錯指南](./X登入錯誤除錯指南.md)
- [X 登入設定檢查清單](./X登入設定檢查清單.md)

---

**最後更新**：2025-01-29




