# X (Twitter) 登入 401 錯誤 - 最終解決方案

## ⚠️ 問題

**錯誤訊息**：`401 Unauthorized`

**發生位置**：調用 Edge Function `/functions/v1/twitter-auth/auth?platform=web`

**原因**：
- Supabase 路由層級在 Edge Function 之前檢查授權
- 即使 Edge Function 使用 `Deno.serve`，Supabase 路由層級仍然要求授權 header
- 即使添加了 `apikey` 和 `Authorization` header，仍然返回 401

---

## 🔍 問題分析

### Supabase Edge Functions 授權機制

Supabase Edge Functions 有兩層授權檢查：

1. **Supabase 路由層級**（在 Edge Function 之前）：
   - 檢查 `apikey` 或 `Authorization` header
   - 如果缺少，返回 401 錯誤
   - **這是我們遇到的問題**

2. **Edge Function 內部**（在 Edge Function 代碼中）：
   - 使用 `Deno.serve` 可以跳過某些檢查
   - 但仍然需要通過路由層級的檢查

---

## ✅ 解決方案

### 方案 1：檢查 Supabase Dashboard 中的 Edge Function 設定（優先）

**Supabase Dashboard 中可能有 Edge Function 的授權設定**：

1. **登入 Supabase Dashboard**
2. **進入 Edge Functions**：
   - https://supabase.com/dashboard/project/epyykzxxglkjombvozhr/functions
3. **找到 `twitter-auth` 函數**
4. **檢查設定**：
   - 是否有 "Require Authorization" 或類似的開關？
   - 是否有 "Public Access" 或 "Allow Anonymous" 選項？
   - 如果有，請關閉授權要求或啟用公開訪問

---

### 方案 2：使用 Supabase Client 的 `functions.invoke` 方法

**Supabase JS Client 提供了 `functions.invoke` 方法**，可以自動處理授權：

**檔案**：`src/pages/AuthPage.tsx`

**修改**：
```typescript
const handleEdgeSocialLogin = async (provider: 'line' | 'twitter') => {
  try {
    const platform = isNative() ? 'app' : 'web';
    const functionName = provider === 'line' ? 'line-auth' : 'twitter-auth';
    
    // 使用 Supabase Client 的 functions.invoke 方法
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { platform },
    });
    
    if (error) {
      throw error;
    }
    
    const authUrl = data?.authUrl;
    if (!authUrl) {
      throw new Error('Edge Function 未返回 authUrl');
    }
    
    // 交給 provider 的 OAuth 頁面
    window.location.href = authUrl;
  } catch (err: any) {
    const providerName = provider === 'line' ? 'LINE' : 'X (Twitter)';
    toast.error(getText('auth_social_login_error', '{{provider}}登入失敗').replace('{{provider}}', providerName), {
      description: err?.message || '未知錯誤'
    });
  }
};
```

**注意**：這需要 Edge Function 接受 POST 請求並從 body 中讀取 `platform` 參數。

---

### 方案 3：修改 Edge Function 接受 GET 請求並處理查詢參數

**如果方案 2 不適用**，可以修改 Edge Function 使其更寬鬆地處理授權：

**檔案**：`supabase/functions/twitter-auth/index.ts`

**檢查**：Edge Function 是否正確處理了無授權的請求

---

### 方案 4：檢查環境變數是否正確載入

**確認前端環境變數是否正確載入**：

1. **在瀏覽器控制台檢查**：
   ```javascript
   console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
   ```

2. **確認值不為 undefined**：
   - 如果為 `undefined`，表示環境變數未正確載入
   - 需要重新啟動開發伺服器

---

## 🔧 立即檢查步驟

### 步驟 1：檢查瀏覽器 Network 標籤

1. **打開瀏覽器開發者工具**（F12）
2. **進入 Network 標籤**
3. **點擊 X 登入按鈕**
4. **找到失敗的請求**：`/functions/v1/twitter-auth/auth?platform=web`
5. **檢查 Request Headers**：
   - 確認 `apikey` header 是否存在
   - 確認 `Authorization` header 是否存在
   - 確認值是否正確

---

### 步驟 2：檢查 Supabase Dashboard

1. **登入 Supabase Dashboard**
2. **進入 Edge Functions** → **twitter-auth**
3. **檢查設定**：
   - 是否有授權相關的設定？
   - 是否有 "Public" 或 "Allow Anonymous" 選項？

---

### 步驟 3：檢查 Edge Function 日誌

1. **登入 Supabase Dashboard**
2. **進入 Edge Functions** → **twitter-auth** → **Logs**
3. **查看最近的日誌**：
   - 確認請求是否到達 Edge Function
   - 如果沒有日誌，表示請求被路由層級攔截

---

## 📋 檢查清單

### 前端代碼
- [x] 已添加 `apikey` header
- [x] 已添加 `Authorization` header
- [ ] 確認環境變數正確載入
- [ ] 確認 headers 正確發送

### Supabase Dashboard
- [ ] 檢查 Edge Function 設定
- [ ] 確認是否有授權相關的開關
- [ ] 檢查 Edge Function 日誌

### 測試
- [ ] 檢查瀏覽器 Network 標籤中的請求 headers
- [ ] 確認 headers 值正確
- [ ] 測試 X 登入功能

---

## 🎯 推薦解決方案

**優先嘗試方案 2**：使用 Supabase Client 的 `functions.invoke` 方法，這是最標準的方式，會自動處理授權。

如果方案 2 不適用，請：
1. 檢查 Supabase Dashboard 中的 Edge Function 設定
2. 確認是否有 "Public Access" 或類似的選項
3. 檢查 Edge Function 日誌，確認請求是否到達

---

**下一步**：請檢查 Supabase Dashboard 中的 Edge Function 設定，並告訴我是否有授權相關的選項。
