# LINE 登入 - 錯誤除錯指南

> **更新日期**：2025-01-29

---

## ❌ 錯誤訊息

### 錯誤 1：中文錯誤訊息
```
{"code":400,"error_code":"validation_failed","msg":"不支援的提供者：找不到提供者行"}
```

### 錯誤 2：英文錯誤訊息（已修復）
```
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: Provider line could not be found"}
```

**原因**：Supabase 不支援 LINE provider，當在 `app_metadata` 中設置 `provider: 'line'` 時，Supabase 會嘗試使用 LINE provider，但找不到它，所以返回錯誤。

**解決方案**：已在 Edge Function 中移除 `app_metadata` 中的 `provider: 'line'`，只保留 `user_metadata` 中的 LINE 相關資訊。

---

## 🔍 可能的原因

這個錯誤訊息可能是由以下原因造成的：

### 1. LINE Channel 設定問題

**檢查項目**：
- ✅ LINE Channel ID 是否正確：`2008600116`
- ✅ LINE Channel Secret 是否正確：`079ebaa784b4c00184e68bafb1841d77`
- ✅ Callback URL 是否已正確設定在 LINE Developers Console

### 2. OpenID Connect 設定問題

**檢查項目**：
- ✅ LINE Developers Console → LINE Login → **OpenID Connect** 是否已啟用
- ✅ **Assertion Signing Key** 是否已正確設定（如果需要的話）

### 3. Scope 設定問題

**檢查項目**：
- ✅ 確認 Edge Function 使用的 scope 為：`profile openid email`
- ✅ 確認 LINE Developers Console 中已啟用對應的權限

### 4. Callback URL 不匹配

**檢查項目**：
- ✅ LINE Developers Console 中的 Callback URL 必須包含：
  ```
  https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
  ```
- ✅ Edge Function 中的 `LINE_REDIRECT_URI` 環境變數必須與上述 URL 完全一致

---

## 🔧 解決步驟

### 步驟 1：檢查 LINE Developers Console 設定

1. **登入 LINE Developers Console**
   - 前往：https://developers.line.biz/console/
   - 選擇 Provider：`ChaosRegistry`
   - 選擇 Channel：`2008600116`

2. **檢查 Basic settings**
   - 確認 Channel ID：`2008600116`
   - 確認 Channel Secret：`079ebaa784b4c00184e68bafb1841d77`

3. **檢查 LINE Login 設定**
   - 進入 **LINE Login** 頁面
   - 確認 **Callback URL** 包含：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
     ```
   - 確認 **OpenID Connect** 已啟用

4. **檢查 Permissions**
   - 確認 **PROFILE** 已啟用
   - 確認 **OPENID_CONNECT** 已啟用
   - 確認 **Email address permission** 狀態（如果需要的話）

### 步驟 2：檢查 Edge Function 環境變數

在 Supabase Dashboard → Edge Functions → Secrets 中，確認以下環境變數已正確設定：

| 變數名稱 | 值 | 檢查 |
|---------|-----|------|
| `LINE_CHANNEL_ID` | `2008600116` | ✅ |
| `LINE_CHANNEL_SECRET` | `079ebaa784b4c00184e68bafb1841d77` | ✅ |
| `LINE_REDIRECT_URI` | `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback` | ✅ |

### 步驟 3：檢查 Edge Function 日誌

1. **進入 Supabase Dashboard**
   - 前往：https://app.supabase.com/project/epyykzxxglkjombvozhr/functions/line-auth/logs

2. **查看最近的日誌**
   - 尋找錯誤訊息
   - 確認是否有更詳細的錯誤資訊

3. **常見日誌訊息**：
   - `Failed to exchange token` - Token 交換失敗
   - `No id_token in response` - 沒有收到 id_token
   - `No LINE user ID in id_token` - id_token 中沒有用戶 ID

### 步驟 4：測試授權 URL

在瀏覽器中訪問：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/auth?platform=app
```

**預期行為**：
- 應該會重定向到 LINE 授權頁面
- 或返回 JSON 格式的錯誤訊息

**如果出現錯誤**：
- 檢查環境變數是否已設定
- 檢查 Edge Function 是否已部署

### 步驟 5：重新部署 Edge Function

如果修改了程式碼，需要重新部署：

```bash
cd C:\Users\USER\Documents\Mywork\votechaos-main
npx supabase functions deploy line-auth
```

---

## 🔍 詳細除錯

### 檢查 Edge Function 程式碼

確認 Edge Function 使用以下設定：

1. **授權 URL 構建**：
   ```typescript
   const scope = 'profile openid email'
   const authUrl = `https://access.line.me/oauth2/v2.1/authorize?` +
     `response_type=code&` +
     `client_id=${LINE_CHANNEL_ID}&` +
     `redirect_uri=${encodeURIComponent(LINE_REDIRECT_URI)}&` +
     `state=${encodeURIComponent(stateWithPlatform)}&` +
     `scope=${encodeURIComponent(scope)}&` +
     `nonce=${encodeURIComponent(nonce)}`
   ```

2. **Token 交換**：
   ```typescript
   const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/x-www-form-urlencoded',
     },
     body: new URLSearchParams({
       grant_type: 'authorization_code',
       code,
       redirect_uri: LINE_REDIRECT_URI,
       client_id: LINE_CHANNEL_ID,
       client_secret: LINE_CHANNEL_SECRET,
     }),
   })
   ```

3. **ID Token 解析**：
   ```typescript
   const idToken = tokenData.id_token
   const idTokenParts = idToken.split('.')
   const payload = JSON.parse(atob(idTokenParts[1].replace(/-/g, '+').replace(/_/g, '/')))
   const lineUserId = payload.sub
   ```

---

## 📝 檢查清單

- [ ] LINE Channel ID 正確
- [ ] LINE Channel Secret 正確
- [ ] Callback URL 已正確設定在 LINE Developers Console
- [ ] OpenID Connect 已啟用
- [ ] Edge Function 環境變數已正確設定
- [ ] Edge Function 已部署
- [ ] Edge Function 日誌中沒有錯誤
- [ ] 授權 URL 可以正常訪問

---

## 🔗 相關文件

- [LINE 登入 - 完整實作步驟](./LINE登入-完整實作步驟.md)
- [LINE 登入 - Edge Function 實作詳細步驟](./LINE登入-EdgeFunction實作步驟.md)
- [LINE 第三方登入完整設定指南](./LINE第三方登入完整設定指南.md)

---

## 📞 需要幫助？

如果問題仍然存在：

1. **檢查 Edge Function 日誌**，尋找更詳細的錯誤訊息
2. **檢查 LINE Developers Console**，確認所有設定都正確
3. **確認環境變數**，特別是 `LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET` 和 `LINE_REDIRECT_URI`
4. **重新部署 Edge Function**，確保使用最新版本的程式碼

---

**如果錯誤訊息是中文的，可能是 LINE API 返回的錯誤。請檢查 LINE Developers Console 中的設定，特別是 OpenID Connect 和 Callback URL 的設定。**

