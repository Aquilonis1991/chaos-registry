# Apple 登入 invalid_client 錯誤最終解決方案

## 🔍 問題確認

即使所有設定看起來都正確，仍然出現 `invalid_client` 錯誤。JWT Token 簽名驗證成功，表示問題可能在 Supabase 的設定格式或 Apple Developer 的設定。

---

## 🎯 關鍵檢查點

### 1. Supabase 的設定格式

根據 Supabase 的版本，Apple Provider 的設定可能有兩種格式：

#### 格式 A：新版本（只需要 Client IDs 和 JWT Token）
- **Client IDs**：`com.votechaos.app.services`
- **Secret Key**：JWT Token

#### 格式 B：舊版本（需要多個欄位）
- **Services ID**：`com.votechaos.app.services`
- **Secret Key**：`.p8` 檔案內容
- **Key ID**：`M9U74KGZDA`
- **Team ID**：`7444X9599R`

**請確認您的 Supabase Dashboard 顯示的是哪種格式。**

---

### 2. JWT Token 的 sub 欄位必須匹配

JWT Token 的 `sub` 欄位必須與 Supabase 的 Client IDs 完全一致：

- JWT Token 的 `sub`：`com.votechaos.app.services`
- Supabase 的 Client IDs：`com.votechaos.app.services`

**必須完全匹配，包括大小寫。**

---

### 3. Apple Developer Key 的關聯

確認 Key 是否正確關聯到 Services ID：

1. 前往 Apple Developer Portal > Keys
2. 找到 Key ID：`M9U74KGZDA`
3. 確認已啟用 Sign In with Apple
4. 確認 Primary App ID 設定為：`com.votechaos.app`

---

## 🔧 解決方案

### 方案 1：檢查 Supabase 是否有 Key ID 和 Team ID 欄位

如果 Supabase Dashboard 中有以下欄位，請填寫：

1. **Key ID**：`M9U74KGZDA`
2. **Team ID**：`7444X9599R`

即使您使用的是 JWT Token，這些欄位可能仍然需要填寫。

---

### 方案 2：確認 JWT Token 的格式

確認 JWT Token 沒有多餘的字符：

1. 從 `secrets/apple-jwt-token.txt` 複製
2. 確認沒有前後空格
3. 確認沒有換行符
4. 確認是單一行文字

---

### 方案 3：檢查 Apple Developer 的設定

確認以下設定完全正確：

1. **Services ID**：
   - Identifier：`com.votechaos.app.services`
   - Sign In with Apple：已啟用
   - Primary App ID：`com.votechaos.app`
   - Domain：`chaos-registry.vercel.app`
   - Return URL：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

2. **App ID**：
   - Identifier：`com.votechaos.app`
   - Sign In with Apple：已啟用

3. **Key**：
   - Key ID：`M9U74KGZDA`
   - Sign In with Apple：已啟用
   - Primary App ID：`com.votechaos.app`

---

### 方案 4：重新建立 Key（最後手段）

如果以上都正確但仍然有錯誤，可能需要重新建立 Key：

1. 在 Apple Developer Portal > Keys
2. 建立新的 Key
3. 記下新的 Key ID
4. 下載新的 `.p8` 檔案
5. 使用新的 Key 生成 JWT Token
6. 更新 Supabase 設定

---

## 📝 請確認

請檢查 Supabase Dashboard 的 Apple Provider 設定頁面，並告訴我：

1. **您看到哪些欄位？**
   - Client IDs
   - Secret Key
   - Key ID（如果有）
   - Team ID（如果有）
   - Services ID（如果有）

2. **每個欄位目前填入的是什麼？**

3. **是否有任何錯誤訊息或警告？**

根據您的回答，我可以提供更具體的解決方案。
