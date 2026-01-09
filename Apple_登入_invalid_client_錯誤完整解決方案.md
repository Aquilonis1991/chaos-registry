# Apple 登入 invalid_client 錯誤完整解決方案

## 🔍 錯誤訊息

```
"error": "oauth2: \"invalid_client\"",
"msg": "500: Unable to exchange external code: ..."
```

## 📋 問題分析

即使所有設定看起來都正確，仍然出現 `invalid_client` 錯誤。這通常表示 Supabase 無法使用提供的憑證與 Apple 交換授權碼。

---

## 🔧 完整檢查與解決方案

### 步驟 1：驗證 JWT Token 格式

#### 1.1 檢查 JWT Token 結構

JWT Token 應該包含三個部分，用 `.` 分隔：
```
header.payload.signature
```

#### 1.2 解碼 JWT Token 驗證（可選）

可以使用線上工具（如 https://jwt.io）解碼 JWT Token，確認：
- **Header**：
  ```json
  {
    "alg": "ES256",
    "kid": "M9U74KGZDA",
    "typ": "JWT"
  }
  ```
- **Payload**：
  ```json
  {
    "iss": "7444X9599R",
    "iat": 1767926113,
    "exp": 1783478113,
    "aud": "https://appleid.apple.com",
    "sub": "com.votechaos.app.services"
  }
  ```

#### 1.3 確認 JWT Token 未過期

- 檢查 `exp`（過期時間）是否在未來
- 確認 `iat`（發行時間）是否在過去
- 確認有效期不超過 180 天

---

### 步驟 2：檢查 Supabase Client IDs 格式

#### 2.1 可能的格式問題

Supabase 的 Apple Provider 可能對 Client IDs 格式有特定要求：

**選項 A：只使用 Services ID**
```
com.votechaos.app.services
```

**選項 B：使用兩個 ID（逗號分隔）**
```
com.votechaos.app.services,com.votechaos.app
```

#### 2.2 建議嘗試

1. 先嘗試只使用 Services ID：
   - 在 Supabase Dashboard > Authentication > Providers > Apple
   - Client IDs 欄位填入：`com.votechaos.app.services`
   - 點擊 Save
   - 測試登入

2. 如果不行，再嘗試兩個 ID：
   - Client IDs 欄位填入：`com.votechaos.app.services,com.votechaos.app`
   - 點擊 Save
   - 測試登入

---

### 步驟 3：檢查 Supabase Secret Key 格式

#### 3.1 確認 Secret Key 是 JWT Token

- ✅ 正確：長字串，包含 `.` 分隔符（三個部分）
- ❌ 錯誤：`-----BEGIN PRIVATE KEY-----` 開頭（這是 `.p8` 檔案內容）

#### 3.2 確認沒有多餘字符

- 確認沒有前後空格
- 確認沒有換行符
- 確認沒有多餘的引號

#### 3.3 重新複製 JWT Token

1. 從 `secrets/apple-jwt-token.txt` 檔案中複製
2. 確保完整複製（沒有遺漏）
3. 直接貼上到 Supabase（不要手動輸入）

---

### 步驟 4：檢查 Apple Developer 設定

#### 4.1 確認 Services ID 設定

1. 前往 Apple Developer Portal > Identifiers > Services IDs
2. 點擊 `com.votechaos.app.services`
3. 確認 Sign In with Apple 已啟用
4. 點擊 Configure，確認：
   - Primary App ID：`com.votechaos.app`
   - Domains and Subdomains：`chaos-registry.vercel.app`
   - Return URLs：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

#### 4.2 確認 App ID 設定

1. 前往 Apple Developer Portal > Identifiers > App IDs
2. 點擊 `com.votechaos.app`
3. 確認已啟用：
   - Sign In with Apple
   - Push Notifications（如果使用）
   - In-App Purchase（如果使用）

#### 4.3 確認 Key 設定

1. 前往 Apple Developer Portal > Keys
2. 找到 Key ID：`M9U74KGZDA`
3. 確認已啟用 Sign In with Apple
4. 確認 Primary App ID 設定為：`com.votechaos.app`

---

### 步驟 5：檢查 Supabase 設定細節

#### 5.1 確認所有欄位

在 Supabase Dashboard > Authentication > Providers > Apple：

1. **Enable Apple provider**：✅ 已啟用
2. **Client IDs**：
   - 嘗試：`com.votechaos.app.services`
   - 或：`com.votechaos.app.services,com.votechaos.app`
3. **Secret Key (for OAuth)**：
   - 必須是 JWT Token（長字串，包含 `.`）
   - 從 `secrets/apple-jwt-token.txt` 複製
4. **Allow users without an email**：✅ 已勾選（建議）
5. **Callback URL (for OAuth)**：
   - `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

#### 5.2 重新儲存設定

即使設定看起來正確，請：
1. 重新打開 Apple Provider 設定
2. 檢查每個欄位
3. 點擊 Save
4. 等待儲存完成
5. 確認沒有錯誤訊息

---

### 步驟 6：檢查 Supabase Redirect URLs

1. 前往 Supabase Dashboard > Authentication > URL Configuration
2. 確認 Redirect URLs 包含：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
3. 如果沒有，請添加

---

### 步驟 7：等待配置生效

更新設定後，Supabase 可能需要時間重新載入配置：
1. 等待 1-2 分鐘
2. 清除瀏覽器快取和 Cookie
3. 重新測試 Apple 登入

---

### 步驟 8：檢查 Supabase 日誌

1. 前往 Supabase Dashboard > Logs > Auth Logs
2. 查看最新的認證日誌
3. 檢查是否有更詳細的錯誤訊息
4. 檢查是否有其他相關錯誤

---

## 🎯 重點檢查項目

### 必須確認的項目

1. **JWT Token 格式**：
   - ✅ 是 JWT Token（不是 `.p8` 檔案內容）
   - ✅ 包含三個部分（用 `.` 分隔）
   - ✅ 沒有多餘的空格或換行

2. **Client IDs 格式**：
   - 嘗試只使用 Services ID：`com.votechaos.app.services`
   - 或使用兩個 ID：`com.votechaos.app.services,com.votechaos.app`

3. **Apple Developer 設定**：
   - ✅ Services ID 已啟用 Sign In with Apple
   - ✅ Return URL 完全匹配
   - ✅ Primary App ID 正確設定

4. **Supabase 設定**：
   - ✅ 所有欄位都已正確填寫
   - ✅ 已點擊 Save
   - ✅ 沒有錯誤訊息

---

## 🔄 嘗試的解決方案

### 方案 1：只使用 Services ID

在 Supabase Client IDs 欄位中，只填入：
```
com.votechaos.app.services
```

### 方案 2：使用兩個 ID

在 Supabase Client IDs 欄位中，填入：
```
com.votechaos.app.services,com.votechaos.app
```

### 方案 3：檢查 JWT Token 的 sub 欄位

確認 JWT Token 的 `sub` 欄位是：
```
com.votechaos.app.services
```

這應該與 Client IDs 中的 Services ID 一致。

---

## 📝 請確認

請按照上述步驟逐一檢查，並告訴我：

1. **Client IDs 目前填入的是什麼？**
   - 是一個 ID 還是兩個 ID？
   - 具體內容是什麼？

2. **Secret Key 的格式是什麼？**
   - 是 JWT Token 還是 `.p8` 檔案內容？
   - 是否包含 `.` 分隔符？

3. **是否已重新儲存設定？**
   - 是否點擊了 Save？
   - 是否有任何錯誤訊息？

4. **Apple Developer 的 Return URL 是什麼？**
   - 是否完全匹配 Supabase 的 Callback URL？

根據您的結果，我可以提供更具體的解決方案。
