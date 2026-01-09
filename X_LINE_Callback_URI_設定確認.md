# X (Twitter) 和 LINE 登入 Callback URI 設定確認

## 📋 重要區別

### ⚠️ 關鍵差異

**X (Twitter) 和 LINE 登入使用 Edge Functions，不是 Supabase 內建的 Provider！**

因此，它們的 Callback URI **與其他 Provider 不同**。

---

## 🔍 Callback URI 對照表

### Supabase 內建 Provider（使用標準回調 URL）

這些 Provider 使用 Supabase 的標準 OAuth 回調：

| Provider | Callback URI |
|----------|-------------|
| **Google** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` |
| **Apple** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` |
| **Discord** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` |
| **Facebook** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` |

✅ **您提到的 Callback URI**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

**適用於**：Google、Apple、Discord、Facebook 等 Supabase 內建 Provider

---

### Edge Functions Provider（使用自訂回調 URL）

這些 Provider 使用自訂的 Edge Function 回調：

| Provider | Callback URI |
|----------|-------------|
| **LINE** | `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback` |

⚠️ **注意**：LINE 使用 **Edge Function** 的回調 URL，不是 Supabase 標準回調 URL！

**更新**：X (Twitter) 已改為使用 Supabase 內建 Provider，與 Google、Apple、Discord 一致。

---

## ✅ X (Twitter) 登入設定

### X Developer Portal 設定

**Callback URI 應該設定為**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

**不是**：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback  ❌（舊設定）
```

**原因**：
- X (Twitter) 登入已改為使用 Supabase 內建 Provider（與 Google、Apple、Discord 一致）
- 使用 Supabase 標準回調 URL：`/auth/v1/callback`
- 不再使用 Edge Function

---

### 檢查步驟

1. **登入 X Developer Portal**：https://developer.x.com/
2. **進入應用程式設定**：
   - 選擇您的專案
   - 選擇您的應用程式
   - 進入 **「User authentication settings」**
3. **檢查 Callback URI**：
   - [ ] 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - [ ] **不是**：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`（舊設定）

---

## ✅ LINE 登入設定

### LINE Developers Console 設定

**Callback URL 應該設定為**：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
```

**不是**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback  ❌
```

**原因**：
- LINE 登入使用 Edge Function `line-auth`
- Edge Function 有自己的回調端點：`/functions/v1/line-auth/callback`
- 必須與 Edge Function 的實作一致

---

### 檢查步驟

1. **登入 LINE Developers Console**：https://developers.line.biz/console/
2. **進入 Channel 設定**：
   - 選擇您的 Provider
   - 選擇您的 Channel
   - 進入 **「LINE Login」** 設定
3. **檢查 Callback URL**：
   - [ ] 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
   - [ ] **不是**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

---

## 🔍 為什麼不同？

### Supabase 內建 Provider（Google、Apple、Discord、X (Twitter)）

**流程**：
```
用戶點擊登入 → Supabase 處理 OAuth → Provider 回調到 Supabase → Supabase 建立 session
```

**回調 URL**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

**包含的 Provider**：
- Google
- Apple
- Discord
- X (Twitter) ✅ **已更新**

---

### Edge Functions Provider（LINE）

**流程**：
```
用戶點擊登入 → Edge Function 處理 OAuth → Provider 回調到 Edge Function → Edge Function 建立 session
```

**回調 URL**：
```
LINE: https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
```

**注意**：目前只有 LINE 使用 Edge Function，X (Twitter) 已改為 Supabase 內建 Provider。

---

## 📝 完整設定檢查清單

### X (Twitter) 登入

#### X Developer Portal
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] **不是**：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`（舊設定）

#### Supabase Dashboard
- [ ] X (Twitter) Provider 已啟用
- [ ] Client ID 已填入
- [ ] Client Secret 已填入
- [ ] 設定已儲存

---

### LINE 登入

#### LINE Developers Console
- [ ] Callback URL 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
- [ ] **不是**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

#### Supabase Edge Functions
- [ ] Edge Function `line-auth` 已部署
- [ ] 環境變數已設定（`LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET`、`SERVICE_ROLE_KEY`）

---

### 其他 Provider（Google、Apple、Discord 等）

#### Provider 設定（Google Cloud Console、Apple Developer Portal 等）
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] ✅ **這是正確的**（您提到的 Callback URI）

#### Supabase Dashboard
- [ ] Provider 已在 Supabase Dashboard 中啟用
- [ ] Client ID 和 Client Secret 已填入

---

## ⚠️ 常見錯誤

### 錯誤 1：X/Twitter 使用錯誤的 Callback URI

**錯誤設定**（舊設定）：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback  ❌
```

**正確設定**（新設定）：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback  ✅
```

**注意**：X (Twitter) 已改為使用 Supabase 內建 Provider，與 Google、Apple、Discord 一致。

**錯誤訊息**：
- `redirect_uri_mismatch`
- `Invalid redirect URI`
- `Callback URL mismatch`

---

### 錯誤 2：LINE 使用錯誤的 Callback URL

**錯誤設定**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback  ❌
```

**正確設定**：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback  ✅
```

**錯誤訊息**：
- `redirect_uri_mismatch`
- `Invalid redirect URI`
- `Callback URL mismatch`

---

## 🎯 總結

### 您提到的 Callback URI

```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

**適用於**：
- ✅ Google OAuth
- ✅ Apple Sign In
- ✅ Discord OAuth
- ✅ Facebook OAuth
- ✅ X (Twitter) 登入 ✅ **已更新**
- ✅ 其他 Supabase 內建 Provider

**不適用於**：
- ❌ LINE 登入（需要使用 Edge Function 回調 URL）

---

### LINE 的正確 Callback URI

**LINE**：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
```

**注意**：目前只有 LINE 使用 Edge Function，X (Twitter) 已改為 Supabase 內建 Provider。

---

## 🔧 如果發現設定錯誤

### 修正 X Developer Portal 設定

1. 登入 X Developer Portal
2. 進入 **「User authentication settings」**
3. 更新 **Callback URI** 為：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
4. 儲存設定

**注意**：X (Twitter) 已改為使用 Supabase 內建 Provider，回調 URL 與 Google、Apple、Discord 一致。

---

### 修正 LINE Developers Console 設定

1. 登入 LINE Developers Console
2. 進入 **「LINE Login」** 設定
3. 更新 **Callback URL** 為：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
   ```
4. 儲存設定

---

## 📚 參考文件

- `X_LINE_登入_網頁版檢查報告.md` - 完整的檢查報告
- `X登入設定指南-2025最新版.md` - X 登入詳細設定指南
- `LINE登入-實作檢查清單.md` - LINE 登入詳細設定指南

---

**重要提醒**：
- ✅ X (Twitter) 已改為使用 Supabase 內建 Provider，Callback URI 應設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- ⚠️ LINE 仍使用 Edge Function，Callback URL 應設定為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
