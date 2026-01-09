# Apple 登入 - 下一步檢查清單

## ✅ 已確認項目

### App ID 設定
- ✅ **Bundle ID**：`com.votechaos.app` (explicit)
- ✅ **App ID Prefix**：`7444X9599R` (Team ID)
- ✅ **Platform**：iOS, iPadOS, macOS, tvOS, watchOS, visionOS
- ✅ **Description**：正確（無特殊字符）

---

## 🔍 下一步需要檢查的項目

### 1. App ID 的 Sign In with Apple 設定 ⭐ 最重要

#### 步驟 1.1：檢查是否啟用 Sign In with Apple

1. 在 App ID 詳細頁面（`com.votechaos.app`）
2. 找到 **Capabilities** 區域
3. 確認 **Sign In with Apple** 的狀態：
   - ✅ 應該顯示「**Enabled**」或「**已啟用**」
   - ✅ 應該有「**Configure**」按鈕

**如果沒有啟用：**
- 點擊 **Sign In with Apple** 旁邊的開關或勾選框
- 點擊 **Configure** 按鈕

#### 步驟 1.2：檢查是否設定為 Primary App ID

1. 點擊 **Sign In with Apple** 的 **Configure** 按鈕
2. 在彈出視窗中，找到 **Sign In with Apple: App ID Configuration** 區域
3. 確認是否有以下選項：
   - **Enable as a primary App ID**（啟用為主要 App ID）
   - **Group with an existing primary App ID**（與現有主要 App ID 分組）

4. **必須選擇：**
   - ✅ **Enable as a primary App ID**（如果是第一次啟用）
   - 或
   - ✅ **Group with an existing primary App ID**（如果已經有其他 Primary App ID）

**如果沒有設定為 Primary：**
- Services ID 無法正確關聯
- 會導致 `invalid_client` 錯誤

---

### 2. Services ID 的 Primary App ID 關聯

#### 步驟 2.1：檢查 Services ID 設定

1. 前往 **Services IDs** 標籤
2. 點擊 `com.votechaos.app.services`
3. 點擊 **Sign In with Apple** 的 **Configure** 按鈕

#### 步驟 2.2：檢查 Primary App ID 下拉選單

1. 在設定頁面中，找到 **Primary App ID** 欄位
2. 確認下拉選單中：
   - ✅ 可以選擇 `com.votechaos.app`
   - ✅ 已選擇 `com.votechaos.app`

**如果下拉選單中沒有 `com.votechaos.app`：**
- 表示 App ID 沒有正確設定為 Primary
- 需要回到步驟 1.2 重新設定

---

### 3. Key 的 Primary App ID 關聯

#### 步驟 3.1：檢查 Key 設定

1. 前往 **Keys** 頁面
2. 找到 Key ID：`M9U74KGZDA`
3. 點擊進入詳細頁面

#### 步驟 3.2：檢查 Primary App ID

1. 在 **Sign In with Apple** 區域，確認 **Primary App ID**：
   - ✅ 應該顯示：`com.votechaos.app`
   - ✅ 如果顯示其他 App ID 或空白，需要重新設定

---

### 4. Services ID 的 Web Authentication 設定

#### 步驟 4.1：檢查 Domains and Subdomains

1. 在 Services ID 的 **Sign In with Apple** 設定頁面
2. 找到 **Web Authentication Configuration** 區域
3. 確認 **Domains and Subdomains**：
   - ✅ 應該填寫：`chaos-registry.vercel.app`
   - ❌ 不應該填寫：`epyykzxxglkjombvozhr.supabase.co`

#### 步驟 4.2：檢查 Return URLs

1. 確認 **Return URLs**：
   - ✅ 應該包含：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - ✅ 必須完全匹配，包括 `https://` 和完整路徑

---

### 5. Supabase Apple Provider 設定

#### 步驟 5.1：檢查 Client IDs

1. 前往 Supabase Dashboard > Authentication > Providers > Apple
2. 確認 **Client IDs**：
   - ✅ 應該填寫：`com.votechaos.app.services`
   - 或
   - ✅ 可以填寫：`com.votechaos.app.services,com.votechaos.app`（兩個 ID 用逗號分隔）

#### 步驟 5.2：檢查 Secret Key

1. 確認 **Secret Key (for OAuth)**：
   - ✅ 應該填入 JWT Token（從 `secrets/apple-jwt-token.txt` 複製）
   - ✅ JWT Token 簽名驗證已成功

#### 步驟 5.3：檢查 Callback URL

1. 確認 **Callback URL (for OAuth)**：
   - ✅ 應該顯示：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - ✅ 已確認正確

---

## 🎯 優先檢查順序

### 第一優先（最重要）⭐

1. **App ID 是否啟用 Sign In with Apple**
   - 如果沒有啟用，Services ID 和 Key 都無法使用

2. **App ID 是否設定為 Primary App ID**
   - 如果沒有設定為 Primary，Services ID 無法正確關聯

### 第二優先

3. **Services ID 的 Primary App ID 關聯**
   - 確認可以選擇 `com.votechaos.app`

4. **Services ID 的 Domains and Subdomains**
   - 確認填寫的是 `chaos-registry.vercel.app`

### 第三優先

5. **Key 的 Primary App ID 關聯**
   - 確認已選擇 `com.votechaos.app`

6. **Supabase 設定**
   - 確認 Client IDs、Secret Key、Callback URL 都正確

---

## 📝 檢查結果記錄

請在檢查後，記錄以下資訊：

### App ID (`com.votechaos.app`)
- [ ] Sign In with Apple 已啟用
- [ ] 已設定為 Primary App ID
- [ ] 沒有錯誤訊息或警告

### Services ID (`com.votechaos.app.services`)
- [ ] Primary App ID 已選擇：`com.votechaos.app`
- [ ] Domains and Subdomains：`chaos-registry.vercel.app`
- [ ] Return URLs：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

### Key (`M9U74KGZDA`)
- [ ] Primary App ID 已選擇：`com.votechaos.app`

### Supabase Apple Provider
- [ ] Client IDs：`com.votechaos.app.services`
- [ ] Secret Key：JWT Token（已驗證）
- [ ] Callback URL：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

---

## 🔍 如果所有設定都正確但仍然有錯誤

如果確認所有設定都正確但仍然出現 `invalid_client` 錯誤：

1. **等待設定生效**：Apple 的設定可能需要幾分鐘才能生效
2. **清除瀏覽器快取**：清除瀏覽器的 cookies 和快取
3. **重新生成 JWT Token**：即使簽名驗證成功，也可以嘗試重新生成
4. **檢查 Supabase Auth Logs**：查看是否有其他錯誤訊息

---

## 📚 參考文件

- `Apple_App_ID_設定檢查.md` - App ID 設定詳細說明
- `Apple_Domains_設定檢查.md` - Domains and Subdomains 設定說明
- `Apple_登入錯誤檢查清單_詳細步驟.md` - 完整檢查步驟
