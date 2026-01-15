# X (Twitter) 移除 Edge Function 調用 - 修復

## 🔍 問題發現

在檢查代碼時發現，雖然我們已經將 Twitter 登入切換到 Supabase 內建 Provider，但**回調處理代碼仍然會嘗試調用 `twitter-auth` Edge Function**。

這可能導致：
1. 回調處理邏輯混亂
2. 可能干擾 Supabase 內建的處理流程
3. 可能導致 "provider is not enabled" 錯誤

---

## ✅ 修復內容

### 修改的文件

1. **`src/components/OAuthCallbackHandler.tsx`**
   - 移除對 `twitter-auth` Edge Function 的調用
   - 只對 LINE 使用 Edge Function
   - Twitter 現在使用 Supabase 內建流程

2. **`src/pages/OAuthCallbackPage.tsx`**
   - 移除對 `twitter-auth` Edge Function 的調用
   - 只對 LINE 使用 Edge Function
   - Twitter 現在使用 Supabase 內建流程

---

## 📋 修改詳情

### OAuthCallbackHandler.tsx

**修改前**：
```typescript
const provider = params.provider || 'twitter';
if (code && state && !params.access_token && !params.refresh_token) {
  const functionName = provider === 'line' ? 'line-auth' : 'twitter-auth';
  // 調用 Edge Function
}
```

**修改後**：
```typescript
const provider = params.provider || 'line';
// 只對 LINE 使用 Edge Function，Twitter 使用 Supabase 內建流程
if (code && state && !params.access_token && !params.refresh_token && provider === 'line') {
  const functionName = 'line-auth';
  // 只調用 LINE Edge Function
}
```

### OAuthCallbackPage.tsx

**修改前**：
```typescript
if (code && state && !hashParams.get('access_token') && !urlParams.get('access_token')) {
  const isTwitter = provider === 'twitter' || (!provider && state.includes('.'));
  const functionName = isTwitter ? 'twitter-auth' : 'line-auth';
  // 對 Twitter 和 LINE 都調用 Edge Function
}
```

**修改後**：
```typescript
// 只對 LINE 使用 Edge Function，Twitter 使用 Supabase 內建流程
if (code && state && !hashParams.get('access_token') && !urlParams.get('access_token') && provider === 'line') {
  const functionName = 'line-auth';
  // 只調用 LINE Edge Function
}
```

---

## 🧪 測試步驟

1. **重新編譯 APP**：
   ```bash
   npm run build
   npm run cap:sync:android
   npm run android
   ```

2. **測試 Twitter 登入**：
   - 點擊 X (Twitter) 登入按鈕
   - 應該跳轉到 X 授權頁面
   - 授權後應該返回並完成登入
   - **不應該再出現 "provider is not enabled" 錯誤**

3. **測試 LINE 登入**（確認沒有破壞）：
   - 點擊 LINE 登入按鈕
   - 應該仍然使用 Edge Function
   - 應該正常登入

---

## 📋 當前狀態

### Twitter 登入流程
- ✅ 使用 Supabase 內建 Provider
- ✅ 使用 `handleSocialLogin('twitter')`
- ✅ 回調由 Supabase 自動處理（不再調用 Edge Function）
- ✅ 與 Google 和 Apple 使用相同的流程

### LINE 登入流程
- ✅ 仍然使用 Edge Function (`line-auth`)
- ✅ 使用 `handleEdgeSocialLogin('line')`
- ✅ 回調由 Edge Function 處理

---

## ⚠️ 重要提醒

1. **Edge Function `twitter-auth` 可以保留或刪除**：
   - 如果不再需要，可以刪除 Edge Function
   - 如果保留，也不會影響（因為代碼不再調用它）

2. **需要重新編譯 APP**：
   - 修改後需要重新編譯並部署到 APP
   - 網頁版會自動使用新代碼

3. **如果問題仍然存在**：
   - 這可能是 Supabase 平台的問題
   - 建議聯繫 Supabase 支援

---

**更新日期**：2026-01-13  
**狀態**：已移除 Edge Function 調用，等待測試結果
