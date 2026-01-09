# Apple 登入 - 最終檢查清單

## ✅ 已確認項目

### App ID 設定
- ✅ **Bundle ID**：`com.votechaos.app` (explicit)
- ✅ **App ID Prefix**：`7444X9599R` (Team ID)
- ✅ **Sign In with Apple**：已啟用
- ✅ **Primary App ID**：已設定為 Primary
- ✅ **Services ID 關聯**：可以選擇 `com.votechaos.app`

---

## 🔍 剩餘需要檢查的項目

### 1. Services ID 的 Web Authentication 設定 ⭐ 最重要

#### 檢查 Domains and Subdomains

**位置：** Apple Developer Portal > Services IDs > `com.votechaos.app.services` > Sign In with Apple > Configure > Web Authentication Configuration

**應該填寫：**
```
chaos-registry.vercel.app
```

**不應該填寫：**
```
epyykzxxglkjombvozhr.supabase.co
```

**原因：**
- Apple 使用這個域名來驗證 OAuth 請求的來源
- 這個域名必須與您的應用程式實際運行的域名匹配
- Supabase 的域名只是用於接收授權碼，不是用於驗證來源

#### 檢查 Return URLs

**應該填寫：**
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

**確認要點：**
- ✅ 必須包含 `https://`
- ✅ 必須包含完整的域名和路徑
- ✅ 必須與 Supabase Dashboard 中的 Callback URL 完全一致

---

### 2. Key 的 Primary App ID 關聯

#### 檢查 Key 設定

**位置：** Apple Developer Portal > Keys > `M9U74KGZDA` > Sign In with Apple

**應該顯示：**
- ✅ Primary App ID：`com.votechaos.app`
- ✅ 如果顯示其他 App ID 或空白，需要重新設定

---

### 3. Supabase Apple Provider 設定

#### 檢查 Client IDs

**位置：** Supabase Dashboard > Authentication > Providers > Apple

**應該填寫：**
```
com.votechaos.app.services
```

**或（如果 Supabase 支援多個 ID）：**
```
com.votechaos.app.services,com.votechaos.app
```

#### 檢查 Secret Key

**應該填寫：**
- ✅ JWT Token（從 `secrets/apple-jwt-token.txt` 複製）
- ✅ JWT Token 簽名驗證已成功

#### 檢查 Callback URL

**應該顯示：**
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

**已確認：** ✅ 正確

---

## 🎯 最可能導致 invalid_client 的原因

根據目前的檢查，最可能導致 `invalid_client` 錯誤的原因是：

### 1. Domains and Subdomains 設定不正確 ⭐⭐⭐

**如果填寫了 Supabase 的域名：**
- Apple 無法驗證 OAuth 請求的來源
- 會導致 `invalid_client` 錯誤

**解決方案：**
- 確認填寫的是：`chaos-registry.vercel.app`
- 不是：`epyykzxxglkjombvozhr.supabase.co`

### 2. Return URLs 格式不正確 ⭐⭐

**如果格式不正確：**
- 缺少 `https://`
- 路徑不完整
- 會導致 `invalid_client` 錯誤

**解決方案：**
- 確認格式：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- 必須完全匹配 Supabase 的 Callback URL

### 3. Key 的 Primary App ID 關聯不正確 ⭐

**如果 Key 沒有關聯到正確的 App ID：**
- 生成的 JWT Token 可能無法被 Apple 驗證
- 會導致 `invalid_client` 錯誤

**解決方案：**
- 確認 Key 的 Primary App ID 是：`com.votechaos.app`

---

## 📝 請檢查並確認

### Services ID (`com.votechaos.app.services`)

請前往 Apple Developer Portal > Services IDs > `com.votechaos.app.services` > Sign In with Apple > Configure，確認：

1. **Primary App ID**：
   - [ ] 已選擇：`com.votechaos.app`

2. **Domains and Subdomains**：
   - [ ] 填寫的是：`chaos-registry.vercel.app`
   - [ ] **不是**：`epyykzxxglkjombvozhr.supabase.co`

3. **Return URLs**：
   - [ ] 包含：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - [ ] 格式完全正確（包含 `https://` 和完整路徑）

### Key (`M9U74KGZDA`)

請前往 Apple Developer Portal > Keys > `M9U74KGZDA` > Sign In with Apple，確認：

1. **Primary App ID**：
   - [ ] 已選擇：`com.votechaos.app`

### Supabase Apple Provider

請前往 Supabase Dashboard > Authentication > Providers > Apple，確認：

1. **Client IDs**：
   - [ ] 填寫的是：`com.votechaos.app.services`
   - [ ] 或：`com.votechaos.app.services,com.votechaos.app`

2. **Secret Key (for OAuth)**：
   - [ ] 已填入 JWT Token
   - [ ] JWT Token 簽名驗證已成功

3. **Callback URL (for OAuth)**：
   - [ ] 顯示：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - [ ] 已確認正確

---

## 🔧 如果所有設定都正確但仍然有錯誤

### 步驟 1：等待設定生效

Apple 的設定可能需要幾分鐘才能生效：
- 修改設定後，等待 5-10 分鐘
- 清除瀏覽器快取
- 重新嘗試登入

### 步驟 2：重新生成 JWT Token

即使 JWT Token 簽名驗證成功，也可以嘗試重新生成：

```bash
cd votechaos-main
node scripts/update-apple-jwt.cjs
```

然後更新 Supabase Dashboard 中的 Secret Key。

### 步驟 3：檢查 Supabase Auth Logs

前往 Supabase Dashboard > Authentication > Logs，查看是否有其他錯誤訊息。

### 步驟 4：檢查瀏覽器 Console

在瀏覽器中打開開發者工具（F12），查看 Console 是否有其他錯誤訊息。

---

## 📚 參考文件

- `Apple_Domains_設定檢查.md` - Domains and Subdomains 詳細說明
- `Apple_App_ID_設定檢查.md` - App ID 設定詳細說明
- `Apple_登入錯誤檢查清單_詳細步驟.md` - 完整檢查步驟

---

## 🎯 下一步

請檢查並確認：

1. **Services ID 的 Domains and Subdomains** 是否為 `chaos-registry.vercel.app`？
2. **Services ID 的 Return URLs** 是否為 `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`？
3. **Key 的 Primary App ID** 是否為 `com.votechaos.app`？

如果這些都正確，請告訴我，我會提供進一步的排查步驟。
