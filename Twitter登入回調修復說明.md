# Twitter 登入回調修復說明

**修復時間**: 2025年1月  
**問題**: Twitter 授權後未回到應用，而是導回網頁版登入頁

---

## 🐛 問題描述

在 Android 應用中使用 Twitter 登入時：
1. ✅ 點擊 Twitter 登入按鈕
2. ✅ Edge Function 返回授權 URL
3. ✅ WebView 載入 Twitter 授權頁面
4. ✅ 用戶完成授權
5. ❌ **授權後重定向到網頁版登入頁，而不是回到應用**

---

## 🔍 問題根本原因

### 問題流程分析

1. **授權流程**:
   ```
   應用內 WebView → Twitter 授權頁 → Supabase callback URL
   ```

2. **Edge Function 處理**:
   - Twitter 重定向到: `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback?code=...&state=...`
   - Edge Function 的 GET callback 處理（第146-200行）會重定向到 `FRONTEND_URL/auth/callback`
   - **問題**: 這是一個網頁 URL，而不是 Deep Link

3. **結果**:
   - 用戶在外部瀏覽器中看到網頁版登入頁
   - 應用無法接收到回調

---

## ✅ 修復方案

### 1. Edge Function 修復

**檔案**: `supabase/functions/twitter-auth/index.ts`

**修復內容**:
- ✅ 在 GET callback 處理中，檢測是否為 App 登入（通過驗證 state 參數）
- ✅ 如果是 App 登入（`platform === 'app'`），重定向到 Deep Link `votechaos://auth/callback`
- ✅ 如果不是 App 登入，重定向到網頁 URL（保持原有行為）

**關鍵改進**:
```typescript
// 驗證 state 以獲取 platform 資訊
const stateVerification = await verifySignedState(state)
if (stateVerification.valid && stateVerification.platform === 'app') {
  // 重定向到 Deep Link
  const deepLinkUrl = `${FRONTEND_DEEP_LINK}?code=...&state=...`
  // 返回 HTML 頁面，自動重定向到 Deep Link
}
```

---

### 2. OAuthCallbackHandler 修復

**檔案**: `src/components/OAuthCallbackHandler.tsx`

**修復內容**:
- ✅ 處理 Deep Link 回調中的 `code` 和 `state` 參數
- ✅ 如果只有 `code` 和 `state`（沒有 `access_token`），調用 Edge Function 交換 tokens
- ✅ Edge Function 返回 Deep Link 後，遞迴處理以設置 session

**關鍵改進**:
```typescript
// 如果只有 code 和 state，調用 Edge Function
if (code && state && !params.access_token) {
  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    body: JSON.stringify({ code, state })
  });
  
  if (data?.redirectUrl?.startsWith('votechaos://')) {
    // 解析 Deep Link 參數並遞迴處理
    window.dispatchEvent(new CustomEvent('oauth-callback', { 
      detail: { url: data.redirectUrl, params: deepLinkParams } 
    }));
  }
}
```

---

### 3. app-lifecycle 改進

**檔案**: `src/lib/app-lifecycle.ts`

**修復內容**:
- ✅ 改進日誌輸出，顯示更多調試資訊
- ✅ 確保正確解析 Deep Link 的 query 參數和 hash fragment

---

### 4. MainActivity 改進

**檔案**: `android/app/src/main/java/com/votechaos/app/MainActivity.java`

**修復內容**:
- ✅ 添加對 Supabase callback URL 的檢測
- ✅ 如果包含 `code` 和 `state` 參數，讓 WebView 正常載入（不攔截）
- ✅ 確保 Edge Function 的重定向能夠正常執行

---

## 🔄 修復後的流程

### 正確的流程

1. **用戶點擊 Twitter 登入**
   ```
   應用內 → Edge Function → Twitter 授權 URL
   ```

2. **WebView 載入 Twitter 授權頁**
   ```
   WebView → Twitter OAuth 頁面
   ```

3. **用戶完成授權**
   ```
   Twitter → Supabase callback URL (https://...supabase.co/auth/v1/callback?code=...&state=...)
   ```

4. **Edge Function 處理回調**
   ```
   GET callback → 驗證 state → 檢測 platform='app' → 重定向到 Deep Link
   ```

5. **Deep Link 觸發應用**
   ```
   votechaos://auth/callback?code=...&state=... → 應用打開 → appUrlOpen 事件
   ```

6. **OAuthCallbackHandler 處理**
   ```
   檢測 code/state → 調用 Edge Function → 獲取 tokens → 設置 session → 導向 /home
   ```

---

## 📝 測試步驟

### 1. 測試 Twitter 登入

1. 打開應用
2. 點擊「使用 X (Twitter) 登入」
3. 在 Twitter 授權頁面完成授權
4. **預期結果**: 
   - ✅ 應用自動打開（如果被外部瀏覽器打開）
   - ✅ 顯示「登入成功」提示
   - ✅ 自動導向到首頁 `/home`

### 2. 檢查日誌

查看 Logcat 日誌，應該看到：
```
[app-lifecycle] DEEP LINK RECEIVED
[app-lifecycle] OAuth callback detected
[OAuthCallbackHandler] Code and state found, calling Edge Function
[OAuthCallbackHandler] Session set successfully
```

---

## ⚠️ 注意事項

### 1. 環境變數設置

確保 Edge Function 的環境變數正確設置：
- `FRONTEND_DEEP_LINK`: `votechaos://auth/callback`
- `FRONTEND_URL`: 網頁版 URL（用於非 App 登入）

### 2. Deep Link 配置

確保 `AndroidManifest.xml` 中正確配置了 Deep Link：
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="votechaos" android:host="auth" android:pathPrefix="/callback" />
</intent-filter>
```

### 3. 測試環境

- ✅ 在真實設備上測試（模擬器可能無法正確處理 Deep Link）
- ✅ 確保應用已安裝並可以正常打開
- ✅ 檢查 Logcat 日誌以確認流程

---

## 🎯 修復效果

**修復前**:
- ❌ 授權後停留在外部瀏覽器
- ❌ 顯示網頁版登入頁
- ❌ 無法回到應用

**修復後**:
- ✅ 授權後自動回到應用
- ✅ 正確處理 Deep Link 回調
- ✅ 自動設置 session 並導向首頁

---

## 📋 相關檔案

### 修改的檔案

1. ✅ `supabase/functions/twitter-auth/index.ts` - Edge Function 回調處理
2. ✅ `src/components/OAuthCallbackHandler.tsx` - Deep Link 回調處理
3. ✅ `src/lib/app-lifecycle.ts` - Deep Link 解析
4. ✅ `android/app/src/main/java/com/votechaos/app/MainActivity.java` - WebView URL 攔截

---

## 🔄 後續優化建議

### 短期
1. ✅ 測試 LINE 登入是否也有相同問題
2. ✅ 添加更詳細的錯誤處理和日誌
3. ✅ 測試不同 Android 版本的兼容性

### 長期
1. 📝 考慮使用 Custom Tabs 而不是 WebView（更好的用戶體驗）
2. 📝 添加重試機制（如果 Deep Link 失敗）
3. 📝 優化錯誤提示（如果應用未安裝）

---

**修復完成時間**: 2025年1月  
**修復工具**: Cursor AI
