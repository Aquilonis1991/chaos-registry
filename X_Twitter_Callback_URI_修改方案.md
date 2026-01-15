# X (Twitter) Callback URI 修改方案

## 🎯 目標

將 X Developer Portal 中的 Callback URI 從 Supabase 內建端點改為 Edge Function 路徑，以規避 Supabase 內建認證系統的攔截問題。

---

## 📋 當前配置

### 當前 Callback URI
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

### 問題
- 這是 Supabase 的內建認證端點
- Supabase 內建認證系統會先處理這個請求
- 因為沒有配置 Twitter Provider，會重定向到前端登入頁
- Edge Function 的 GET callback 處理邏輯從未被調用

---

## ✅ 建議的修改方案

### 方案 1: 使用 Edge Function 路徑（推薦嘗試）

#### 新的 Callback URI
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback
```

#### 優點
- ✅ 直接路由到 Edge Function，避免 Supabase 內建認證系統攔截
- ✅ Edge Function 已經有處理 `/callback` 路徑的邏輯
- ✅ 不需要修改 MainActivity.java 的攔截邏輯

#### 需要修改的地方

1. **Edge Function 代碼** (`supabase/functions/twitter-auth/index.ts`):
   ```typescript
   // 修改 TWITTER_REDIRECT_URI
   const TWITTER_REDIRECT_URI = isProduction
     ? 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback'
     : Deno.env.get('TWITTER_REDIRECT_URI') || 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback'
   ```

2. **X Developer Portal**:
   - 登入 X Developer Portal
   - 導航到您的 App
   - 找到 "Callback URI / Redirect URL (required)"
   - 修改為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
   - 保存

#### 潛在問題

⚠️ **X Developer Portal 可能不允許非標準的 callback URL**

根據代碼註釋：
```typescript
// 注意：X Developer Portal 強制要求使用標準 Supabase 回調 URL
```

這表示之前可能嘗試過但被拒絕。不過，值得再次嘗試，因為：
- OAuth 2.0 標準允許任何有效的 HTTPS URL 作為 callback URI
- 其他 OAuth providers（如 Discord、LINE）都允許自定義 callback URL
- X 的規則可能已經改變

---

## 🔍 驗證 Edge Function 路由

Edge Function 的路由邏輯已經支持 `/callback` 路徑：

```typescript
const path = url.pathname
const isCallback = path.endsWith('/callback') || path.endsWith('/callback/')
```

這意味著以下路徑都能被處理：
- ✅ `/functions/v1/twitter-auth/callback`
- ✅ `/functions/v1/twitter-auth/callback/`

---

## 🧪 測試步驟

### 1. 修改 Edge Function 代碼

```typescript
// 在 supabase/functions/twitter-auth/index.ts 中
const TWITTER_REDIRECT_URI = 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback'
```

### 2. 重新部署 Edge Function

```bash
cd votechaos-main
npx supabase functions deploy twitter-auth
```

### 3. 修改 X Developer Portal

1. 登入 [X Developer Portal](https://developer.twitter.com/)
2. 選擇您的 App
3. 導航到 "User authentication settings" 或 "OAuth 2.0 settings"
4. 找到 "Callback URI / Redirect URL (required)"
5. 修改為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
6. 保存

### 4. 測試

1. 執行準備腳本：`.\prepare-for-test.ps1`
2. 啟動應用
3. 點擊 Twitter 登入按鈕
4. 完成授權
5. **應該看到**：直接重定向到應用，而不是網頁版登入頁

---

## ⚠️ 如果 X Developer Portal 拒絕修改

如果 X Developer Portal 不允許使用 Edge Function 路徑，則：

### 方案 2: 保持當前方案（MainActivity 攔截）

繼續使用當前的 MainActivity 攔截方案：
- Callback URI 保持為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- MainActivity 檢測到 Supabase callback URL 時，構建 Deep Link 並觸發
- OAuthCallbackHandler 處理 Deep Link 並調用 Edge Function

這是已經實現的方案，應該可以正常工作。

---

## 📊 方案對比

| 方案 | 優點 | 缺點 |
|------|------|------|
| **方案 1: Edge Function 路徑** | 直接路由，無需攔截 | X 可能不允許 |
| **方案 2: MainActivity 攔截** | 肯定可以工作 | 需要額外的攔截邏輯 |

---

## 🎯 建議

1. **先嘗試方案 1**（修改 Callback URI 為 Edge Function 路徑）
   - 如果 X Developer Portal 允許，這是最簡潔的解決方案
   - 如果被拒絕，回退到方案 2

2. **如果方案 1 失敗，使用方案 2**（MainActivity 攔截）
   - 已經實現，應該可以正常工作
   - 需要測試確認

---

## 📝 下一步

1. **嘗試修改 X Developer Portal 的 Callback URI**
2. **如果成功**：修改 Edge Function 代碼並重新部署
3. **如果失敗**：繼續使用 MainActivity 攔截方案
4. **測試並確認**：無論使用哪個方案，都要測試確認

---

**最後更新**: 2025年1月
