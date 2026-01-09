# X (Twitter) 改用 Supabase 內建 Provider 更新指南

## ✅ 更新完成

**變更**：X (Twitter) 登入現在使用 Supabase 內建的 X / Twitter (OAuth 2.0) Provider，不再使用 Edge Function `twitter-auth`。

---

## 🔄 變更內容

### 1. 更新 `handleSocialLogin` 函數

**檔案**：`src/pages/AuthPage.tsx`

**變更**：
- 添加 `'twitter'` 到 provider 類型
- 添加 `twitter: 'X (Twitter)'` 到 providerNames

**更新前**：
```typescript
const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord') => {
  // ...
  const providerNames: Record<string, string> = {
    google: 'Google',
    apple: 'Apple',
    discord: 'Discord',
  };
}
```

**更新後**：
```typescript
const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord' | 'twitter') => {
  // ...
  const providerNames: Record<string, string> = {
    google: 'Google',
    apple: 'Apple',
    discord: 'Discord',
    twitter: 'X (Twitter)',
  };
}
```

---

### 2. 更新 `handleEdgeSocialLogin` 函數

**檔案**：`src/pages/AuthPage.tsx`

**變更**：
- 移除 `'twitter'` 類型，只保留 `'line'`
- 簡化邏輯（不再需要判斷 provider）

**更新前**：
```typescript
const handleEdgeSocialLogin = async (provider: 'line' | 'twitter') => {
  // ...
  const functionName = provider === 'line' ? 'line-auth' : 'twitter-auth';
  // ...
  const providerName = provider === 'line' ? 'LINE' : 'X (Twitter)';
}
```

**更新後**：
```typescript
const handleEdgeSocialLogin = async (provider: 'line') => {
  // ...
  const { data, error } = await supabase.functions.invoke('line-auth', {
    // ...
  });
  // ...
  // 只處理 LINE，不再需要判斷 provider
}
```

---

### 3. 更新 X (Twitter) 登入按鈕

**檔案**：`src/pages/AuthPage.tsx`

**變更**：
- 從 `handleEdgeSocialLogin('twitter')` 改為 `handleSocialLogin('twitter')`

**更新前**：
```typescript
onClick={() => handleEdgeSocialLogin('twitter')}
```

**更新後**：
```typescript
onClick={() => handleSocialLogin('twitter')}
```

---

## 🔧 需要更新的設定

### 1. Supabase Dashboard 設定

**確認 X Provider 已啟用**：
1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
3. 進入 **Authentication** → **Providers**
4. 找到 **X (Twitter)** 或 **X**
5. 確認：
   - [ ] Provider 已啟用（開關已開啟）
   - [ ] Client ID 已填入
   - [ ] Client Secret 已填入
   - [ ] 設定已儲存

---

### 2. X Developer Portal 設定

**確認 Callback URI**：
1. 登入 [X Developer Portal](https://developer.x.com/)
2. 進入您的專案和應用程式
3. 進入 **「User authentication settings」**
4. 確認 **Callback URI** 為：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
5. 確認其他設定：
   - [ ] App permissions 設定為 "Read"
   - [ ] Type of App 設定為 "Web App, Automated App or Bot"

---

## 📝 更新後的架構

### Supabase 內建 Provider（使用標準回調 URL）

| Provider | 回調 URL | 前端調用 |
|----------|---------|---------|
| **Google** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` | `handleSocialLogin('google')` |
| **Apple** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` | `handleSocialLogin('apple')` |
| **Discord** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` | `handleSocialLogin('discord')` |
| **X (Twitter)** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` | `handleSocialLogin('twitter')` ✅ **已更新** |

---

### Edge Functions Provider（使用自訂回調 URL）

| Provider | 回調 URL | 前端調用 |
|----------|---------|---------|
| **LINE** | `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback` | `handleEdgeSocialLogin('line')` |

---

## ✅ 檢查清單

### 代碼更新
- [x] `handleSocialLogin` 已添加 `'twitter'` 支援
- [x] `handleEdgeSocialLogin` 已移除 `'twitter'`，只保留 `'line'`
- [x] X (Twitter) 按鈕已更新為使用 `handleSocialLogin('twitter')`

### Supabase Dashboard 設定
- [ ] X (Twitter) Provider 已啟用
- [ ] Client ID 已填入
- [ ] Client Secret 已填入
- [ ] 設定已儲存

### X Developer Portal 設定
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] App permissions 設定為 "Read"
- [ ] Type of App 設定為 "Web App, Automated App or Bot"

### 測試
- [ ] 測試 X (Twitter) 登入功能
- [ ] 確認可以正常登入
- [ ] 確認用戶資訊正確顯示

---

## 🧪 測試步驟

### 1. 測試 X (Twitter) 登入

1. 打開 `https://chaos-registry.vercel.app/auth`
2. 點擊 X (Twitter) 登入按鈕
3. 應該跳轉到 X 授權頁面
4. 授權後應該返回並完成登入

**預期結果**：
- ✅ 使用 Supabase 標準回調 URL
- ✅ 與 Google、Apple、Discord 登入流程一致
- ✅ 不需要 Edge Function

---

### 2. 測試 LINE 登入（確認未受影響）

1. 打開 `https://chaos-registry.vercel.app/auth`
2. 點擊 LINE 登入按鈕
3. 應該跳轉到 LINE 授權頁面
4. 授權後應該返回並完成登入

**預期結果**：
- ✅ 仍然使用 Edge Function
- ✅ 回調 URL 仍然是：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
- ✅ 功能正常運作

---

## ⚠️ 重要提醒

### 1. Edge Function `twitter-auth` 不再使用

**注意**：
- Edge Function `twitter-auth` 不再被前端調用
- 可以選擇保留（以防需要回退）或移除
- 如果移除，需要確認沒有其他地方使用

---

### 2. 與其他 Provider 一致

**好處**：
- ✅ 統一的登入流程
- ✅ 統一的回調 URL
- ✅ 更容易維護
- ✅ 減少 Edge Function 的依賴

---

## 📚 相關文件

- `X_Twitter_Supabase_設定確認指南.md` - Supabase 設定確認指南
- `X登入設定指南-2025最新版.md` - X 登入詳細設定指南
- `X_LINE_Callback_URI_設定確認.md` - Callback URI 設定確認

---

## 🎯 下一步

1. **確認 Supabase Dashboard 設定**（最重要）
   - 確認 X Provider 已啟用
   - 確認 Client ID 和 Client Secret 已填入

2. **測試登入功能**
   - 測試 X (Twitter) 登入
   - 確認可以正常運作

3. **可選：清理 Edge Function**
   - 如果確認不再需要，可以移除 `twitter-auth` Edge Function
   - 或保留作為備份

---

**更新完成日期**：2026-01-09  
**狀態**：✅ 代碼已更新，等待 Supabase Dashboard 設定確認和測試
