# Apple Domains and Subdomains 設定檢查

## 🔍 問題確認

即使 Callback URL 正確，`invalid_client` 錯誤仍然可能由 **Domains and Subdomains** 設定不正確導致。

---

## 📋 Apple Developer Services ID 設定

### Web Authentication Configuration

在 Apple Developer Portal > Services ID > `com.votechaos.app.services` > Sign In with Apple 設定中，有兩個重要欄位：

#### 1. Domains and Subdomains（網域和子網域）

**應該填寫什麼？**

根據 Apple 的文檔，這個欄位應該填寫：
- ✅ **您的應用程式主要域名**（例如：`chaos-registry.vercel.app`）
- ❌ **不應該填寫** Supabase 的域名（例如：`epyykzxxglkjombvozhr.supabase.co`）

**原因：**
- Apple 使用這個域名來驗證 OAuth 請求的來源
- 這個域名必須與您的應用程式實際運行的域名匹配
- Supabase 的 callback URL 只是用於接收授權碼，不是用於驗證域名

**正確設定：**
```
chaos-registry.vercel.app
```

**如果有多個域名，用逗號分隔：**
```
chaos-registry.vercel.app,www.chaos-registry.vercel.app
```

---

#### 2. Return URLs（回調 URL）

**應該填寫什麼？**

這個欄位應該填寫 Supabase 的 callback URL：

```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

**確認：**
- ✅ 必須包含 `https://`
- ✅ 必須包含完整的域名和路徑
- ✅ 必須與 Supabase Dashboard 中的 Callback URL 完全一致

---

## 🔧 檢查步驟

### 步驟 1：前往 Apple Developer Portal

1. 登入 [Apple Developer Portal](https://developer.apple.com/)
2. 導航到 **Certificates, Identifiers & Profiles**
3. 點擊 **Identifiers**
4. 找到並點擊 **Services ID**：`com.votechaos.app.services`
5. 點擊 **Edit** 或 **Configure**

### 步驟 2：檢查 Web Authentication Configuration

1. 找到 **Web Authentication Configuration** 區域
2. 確認 **Primary App ID** 已選擇：`com.votechaos.app`
3. 檢查 **Domains and Subdomains** 欄位：
   - 應該填寫：`chaos-registry.vercel.app`
   - 不應該填寫：`epyykzxxglkjombvozhr.supabase.co`
4. 檢查 **Return URLs** 欄位：
   - 應該填寫：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

### 步驟 3：如果設定不正確

1. 修改 **Domains and Subdomains** 為：`chaos-registry.vercel.app`
2. 確認 **Return URLs** 為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
3. 點擊 **Save** 或 **Continue**
4. 等待設定生效（可能需要幾分鐘）

---

## ⚠️ 常見錯誤

### 錯誤 1：Domains and Subdomains 填寫 Supabase 域名

**錯誤設定：**
```
epyykzxxglkjombvozhr.supabase.co
```

**正確設定：**
```
chaos-registry.vercel.app
```

**原因：**
- Apple 需要驗證 OAuth 請求的來源域名
- 這個域名必須是您的應用程式實際運行的域名
- Supabase 的域名只是用於接收授權碼，不是用於驗證來源

---

### 錯誤 2：Domains and Subdomains 留空

**錯誤設定：**
```
（留空）
```

**正確設定：**
```
chaos-registry.vercel.app
```

**原因：**
- Apple 需要知道您的應用程式運行的域名
- 如果留空，Apple 無法驗證 OAuth 請求的來源

---

### 錯誤 3：Return URLs 格式不正確

**錯誤設定：**
```
epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

**正確設定：**
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

**原因：**
- 必須包含 `https://` 協議
- 必須包含完整的域名和路徑

---

## 📝 完整設定範例

### Apple Developer Services ID 設定

**Services ID：** `com.votechaos.app.services`

**Web Authentication Configuration：**
- **Primary App ID：** `com.votechaos.app`
- **Domains and Subdomains：** `chaos-registry.vercel.app`
- **Return URLs：** `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

---

### Supabase Apple Provider 設定

**Client IDs：** `com.votechaos.app.services`

**Secret Key (for OAuth)：** JWT Token（從 `secrets/apple-jwt-token.txt` 複製）

**Allow users without an email：** ✅ 已勾選

**Callback URL (for OAuth)：** `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

---

## ✅ 驗證清單

請確認以下設定：

- [ ] **Apple Developer Services ID**：
  - [ ] Domains and Subdomains：`chaos-registry.vercel.app`
  - [ ] Return URLs：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
  - [ ] Primary App ID：`com.votechaos.app`

- [ ] **Supabase Apple Provider**：
  - [ ] Client IDs：`com.votechaos.app.services`
  - [ ] Secret Key：JWT Token（已驗證簽名成功）
  - [ ] Callback URL：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

---

## 🔍 如果仍然有問題

如果確認所有設定都正確但仍然出現 `invalid_client` 錯誤，請：

1. **等待設定生效**：Apple 的設定可能需要幾分鐘才能生效
2. **清除瀏覽器快取**：清除瀏覽器的 cookies 和快取
3. **檢查 Supabase Auth Logs**：查看是否有其他錯誤訊息
4. **重新生成 JWT Token**：雖然簽名驗證成功，但可以嘗試重新生成

---

## 📚 參考資料

- [Apple Sign In with Apple JS - Configuration](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js/configuring_your_webpage_for_sign_in_with_apple)
- [Supabase Apple Provider Configuration](https://supabase.com/docs/guides/auth/social-login/auth-apple)
