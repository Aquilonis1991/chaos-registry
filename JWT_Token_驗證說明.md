# JWT Token 簽名驗證說明

## 🔍 驗證過程

### 步驟 1：讀取 JWT Token

JWT Token 是一個長字串，包含三個部分，用 `.` 分隔：
```
header.payload.signature
```

例如：
```
eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik05VTc0S0daREEifQ.eyJpc3MiOiI3NDQ0WDk1OTlSIiwiaWF0IjoxNzY3OTI2MTEzLCJleHAiOjE3ODM0NzgxMTMsImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJjb20udm90ZWNoYW9zLmFwcC5zZXJ2aWNlcyJ9.0d_mySf01dB1JX6OVz0n0SSpukWo5UCoWiLnFBxrCCAd7scXkvXyIksU6g7KuDzw7g5inpyu7iNQK8npFtwyXQ
```

### 步驟 2：解碼 JWT Token（不驗證簽名）

使用 `jwt.decode()` 可以解碼 JWT Token，但不驗證簽名：

**Header（標頭）**：
```json
{
  "alg": "ES256",
  "typ": "JWT",
  "kid": "M9U74KGZDA"
}
```

**Payload（負載）**：
```json
{
  "iss": "7444X9599R",
  "iat": 1767926113,
  "exp": 1783478113,
  "aud": "https://appleid.apple.com",
  "sub": "com.votechaos.app.services"
}
```

### 步驟 3：驗證 JWT Token 簽名

使用 `jwt.verify()` 驗證簽名：

1. **讀取私鑰**：從 `.p8` 檔案讀取私鑰
2. **解析簽名**：從 JWT Token 的第三部分（signature）解析簽名
3. **重新計算簽名**：使用私鑰和 Header + Payload 重新計算簽名
4. **比較簽名**：比較重新計算的簽名與 JWT Token 中的簽名
5. **驗證結果**：
   - ✅ 如果簽名匹配：驗證成功
   - ❌ 如果簽名不匹配：驗證失敗

### 步驟 4：驗證結果

如果驗證成功，表示：
- ✅ JWT Token 是由正確的私鑰簽名的
- ✅ JWT Token 的內容沒有被篡改
- ✅ JWT Token 的格式正確

---

## 📋 驗證命令

我使用的驗證命令是：

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

// 讀取 JWT Token
const token = fs.readFileSync('secrets/apple-jwt-token.txt', 'utf8').trim();

// 讀取私鑰
const key = fs.readFileSync('secrets/apple-sign-in-key.p8', 'utf8');

// 驗證簽名
const verified = jwt.verify(token, key, { algorithms: ['ES256'] });
```

這個命令會：
1. 讀取 JWT Token
2. 讀取私鑰（.p8 檔案）
3. 使用 ES256 算法驗證簽名
4. 如果驗證成功，返回解碼後的 Payload
5. 如果驗證失敗，拋出錯誤

---

## ✅ 驗證結果

根據剛才的驗證：

- ✅ **JWT Token 簽名驗證成功**
- ✅ **Header 正確**：使用 ES256 算法，Key ID 為 M9U74KGZDA
- ✅ **Payload 正確**：
  - `iss`（發行者）：7444X9599R（Team ID）
  - `sub`（主體）：com.votechaos.app.services（Services ID）
  - `aud`（受眾）：https://appleid.apple.com
  - `iat`（發行時間）：1767926113
  - `exp`（過期時間）：1783478113（180 天後）

---

## 🔍 這表示什麼？

JWT Token 簽名驗證成功表示：
1. ✅ JWT Token 是由正確的私鑰簽名的
2. ✅ JWT Token 的內容沒有被篡改
3. ✅ JWT Token 的格式正確
4. ✅ 私鑰（.p8 檔案）是正確的

**但是**，這不表示 Supabase 能夠使用這個 JWT Token 與 Apple 交換授權碼。

---

## ⚠️ 可能的問題

即使 JWT Token 簽名驗證成功，仍然可能出現 `invalid_client` 錯誤，可能的原因：

1. **Supabase 設定格式問題**：
   - Client IDs 格式不正確
   - Secret Key 格式不正確
   - 缺少必要的欄位（如 Key ID、Team ID）

2. **Apple Developer 設定問題**：
   - Key 未正確關聯到 Services ID
   - Return URL 不匹配
   - Services ID 設定不正確

3. **JWT Token 與 Client ID 不匹配**：
   - JWT Token 的 `sub` 欄位必須與 Supabase 的 Client IDs 完全一致

---

## 📝 下一步

既然 JWT Token 簽名驗證成功，問題可能在：
1. Supabase 的設定格式
2. Apple Developer 的設定
3. 兩者之間的匹配問題

請檢查 Supabase Dashboard 的 Apple Provider 設定頁面，確認所有欄位都已正確填寫。
