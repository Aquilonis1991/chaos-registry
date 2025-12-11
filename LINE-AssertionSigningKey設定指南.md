# LINE Assertion Signing Key 設定指南

> **適用於**：LINE Developers Console → Basic settings → Assertion Signing Key  
> **更新日期**：2025-01-29

---

## 📋 什麼是 Assertion Signing Key？

Assertion Signing Key 是用於驗證應用程式發送給 LINE 的 JWT (JSON Web Token) 的公鑰。當應用程式需要向 LINE 發送請求時（例如：驗證用戶身份），需要使用私鑰簽名 JWT，LINE 使用公鑰驗證。

---

## ✅ 快速開始（已生成金鑰）

**如果您已經生成了金鑰對**（2025-01-29）：

1. ✅ **公鑰已準備好**：可以直接複製下方格式範例中的公鑰
2. ✅ **私鑰已記錄**：見 [私鑰保管說明](./LINE-AssertionSigningKey-私鑰保管說明.md)
3. ⚠️ **重要**：請確認私鑰已妥善備份到安全位置
4. 📝 **下一步**：直接跳到 [在 LINE Developers Console 中註冊公鑰](#在-line-developers-console-中註冊公鑰)

---

## 🔑 生成 RSA 金鑰對

### 方法 1：使用瀏覽器開發者工具（推薦，最簡單）✅

1. **打開瀏覽器開發者工具**
   - 按 `F12` 鍵
   - 選擇 **「Console」** 頁籤

2. **貼上以下 JavaScript 程式碼並執行**：

```javascript
(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  );

  console.log('=== 私鑰 (Private Key) - 請妥善保管！ ===');
  console.log(JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey), null, 2));

  console.log('\n=== 公鑰 (Public Key) - 用於 LINE Console ===');
  console.log(JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey), null, 2));
})();
```

3. **複製公鑰（Public Key）**
   - 在 Console 中會顯示兩個 JSON 物件
   - 複製 **公鑰（Public Key）** 的 JSON
   - **重要**：私鑰請妥善保管，不要分享

**✅ 已生成金鑰對**（2025-01-29）：
- 公鑰已準備好，可以直接使用（見下方格式範例）
- 私鑰已記錄在 [私鑰保管說明](./LINE-AssertionSigningKey-私鑰保管說明.md)
- **⚠️ 重要**：請查看私鑰保管說明，確保私鑰已妥善備份

### 方法 2：使用 OpenSSL（命令列）

```bash
# 生成私鑰
openssl genrsa -out private_key.pem 2048

# 從私鑰提取公鑰
openssl rsa -in private_key.pem -pubout -out public_key.pem

# 將公鑰轉換為 JWK 格式（需要額外工具）
# 建議使用方法 1（瀏覽器）
```

---

## 📝 在 LINE Developers Console 中註冊公鑰

### 步驟 1：進入 Assertion Signing Key 設定

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇您的 Provider（例如：`ChaosRegistry`）
3. 選擇您的 LINE Login Channel（Channel ID: `2008600116`）
4. 進入 **Basic settings** → **Assertion Signing Key**
5. 點擊 **「Register a public key」** 或 **「Add」** 按鈕

### 步驟 2：填寫公鑰

**欄位要求**：
- **The public key**：貼上公鑰的 JSON
- **格式要求**：
  - ✅ 必須是有效的 JSON
  - ✅ 必須是有效的公鑰（JWK 格式）
  - ❌ **不能包含 `kid` 欄位**（LINE 會自動生成）

**公鑰 JSON 格式範例**（已生成，可直接使用）：

```json
{
  "alg": "RS256",
  "e": "AQAB",
  "ext": true,
  "key_ops": [
    "verify"
  ],
  "kty": "RSA",
  "n": "wy73KQjoYqocqeZYf1zxmumIZXrpVwgEUZ_x0ZJlBJmJmJi3GWWxA_G9gbi5G7vQeSp-7hA2_T3OxqIFr1YJMxZVVivnbvh0O6TfECU5sDusjd5YkdsOTuBofNENBN7aM--JPrKUOt4z3A6USEYBp1Gh8eKOsI-dGxyxsCtv4NuLAak2gYx2SoENf1rIPxrndSvHt_IAwonsweTh3kc6Zrzr7iGf7-SZwgpYWic_msdjGFPmjC6ZiZtfsMz9lyN5a_wwpyQcIraK2ymEPh2R3Fw-SrLfbTk1QwNd-sdiuQOnvyNb3qw6Rb_zGyqtMDUBdMXmyvHCOZcYrt8WYnjW8Q"
}
```

**重要**：
- ✅ 此公鑰已生成，可以直接複製使用
- ✅ 格式正確，包含所有必要欄位
- ✅ **沒有 `kid` 欄位**（LINE 會自動生成）
- ✅ **已提交到 LINE Console**（2025-01-29）
- ✅ **Key ID (kid)**：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126`
- ⚠️ **私鑰已妥善保管**（見下方私鑰保管說明）

**重要欄位說明**：
- `kty`: 金鑰類型，必須是 `"RSA"`
- `use`: 用途，必須是 `"sig"`（簽名）
- `alg`: 演算法，必須是 `"RS256"`
- `n`: RSA 模數（很長的字串）
- `e`: RSA 指數，通常是 `"AQAB"`（65537 的 Base64URL 編碼）

### 步驟 3：提交

1. 確認 JSON 格式正確（可以使用 JSON 驗證工具檢查）
2. 確認**沒有 `kid` 欄位**
3. 點擊 **「Register」** 或 **「Save」** 按鈕
4. LINE 會自動生成 `kid`（Key ID），請妥善保存

**✅ 已成功註冊**（2025-01-29）：
- **Key ID (kid)**：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126`
- **狀態**：公鑰已成功註冊到 LINE Console
- **用途**：此 kid 需要在應用程式中使用，用於 JWT Header 中指定金鑰

---

## ⚠️ 常見錯誤

### 錯誤 1：Invalid JSON

**原因**：JSON 格式不正確

**解決方案**：
1. 使用 JSON 驗證工具檢查格式
2. 確認所有字串都有引號
3. 確認沒有多餘的逗號

### 錯誤 2：Invalid public key

**原因**：公鑰格式不正確

**解決方案**：
1. 確認使用正確的 JWK 格式
2. 確認包含所有必要欄位（kty, use, alg, n, e）
3. 確認 `n` 和 `e` 的值正確

### 錯誤 3：kid should not be included

**原因**：JSON 中包含了 `kid` 欄位

**解決方案**：
1. 從 JSON 中移除 `kid` 欄位
2. LINE 會自動生成 `kid`，不需要手動添加

**範例（錯誤）**：
```json
{
  "kty": "RSA",
  "use": "sig",
  "alg": "RS256",
  "kid": "my-key-id",  // ❌ 移除這一行
  "n": "...",
  "e": "AQAB"
}
```

**範例（正確）**：
```json
{
  "kty": "RSA",
  "use": "sig",
  "alg": "RS256",
  "n": "...",
  "e": "AQAB"
}
```

---

## 🔐 私鑰保管

**重要提醒**：
- ⚠️ **私鑰必須妥善保管**，不要分享或提交到 Git
- ⚠️ **遺失私鑰將無法使用**，需要重新生成金鑰對
- ⚠️ **建議備份私鑰**到安全位置（加密儲存）

**私鑰用途**：
- 用於簽名發送給 LINE 的 JWT token
- 用於驗證應用程式的身份

---

## 🔑 Key ID (kid) 使用說明

### 已獲得的 Key ID

**Key ID (kid)**：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126`

**狀態**：✅ 已成功註冊到 LINE Console

### kid 的用途

1. **JWT Header 中指定金鑰**
   - 在生成 JWT token 時，需要在 Header 中包含 `kid`
   - LINE 使用 `kid` 來識別對應的公鑰進行驗證

2. **JWT Header 範例**：
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "cc31abb4-94d1-4655-aba2-2e7a7e4ab126"
}
```

3. **重要提醒**：
   - ⚠️ `kid` 必須與 LINE Console 中註冊的公鑰對應
   - ⚠️ 如果重新生成金鑰對，`kid` 會改變，需要更新應用程式中的 `kid`
   - ⚠️ `kid` 可以儲存在應用程式的配置文件中（環境變數或設定檔）

### 在應用程式中使用

**建議的儲存方式**：
- 環境變數：`LINE_ASSERTION_KEY_ID=cc31abb4-94d1-4655-aba2-2e7a7e4ab126`
- 設定檔：`.env.local` 或 `config.json`
- **不要**：硬編碼在程式碼中（建議使用環境變數）

---

## ✅ 檢查清單

在提交前，請確認：

- [x] 已生成 RSA 金鑰對（2048 位元）✅ 2025-01-29
- [x] 公鑰格式為有效的 JSON ✅
- [x] 公鑰包含必要欄位：`kty`, `use`, `alg`, `n`, `e` ✅
- [x] **公鑰中沒有 `kid` 欄位** ✅
- [ ] 私鑰已妥善保管（備份到安全位置）⚠️ **請查看 [私鑰保管說明](./LINE-AssertionSigningKey-私鑰保管說明.md)**
- [x] JSON 格式已驗證（無語法錯誤）✅
- [x] 公鑰已提交到 LINE Developers Console ✅ 2025-01-29
- [x] Key ID (kid) 已記錄：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126` ✅
- [ ] kid 已儲存到應用程式配置（環境變數或設定檔）⏳ 待完成

---

## 🔗 相關文件

- [LINE Assertion Signing Key - 私鑰保管說明](./LINE-AssertionSigningKey-私鑰保管說明.md) 🔐 **私鑰備份與保管**
- [LINE 第三方登入完整設定指南](./LINE第三方登入完整設定指南.md)
- [LINE Login API 文件](https://developers.line.biz/en/docs/line-login/integrate-line-login/)

---

## 📝 快速步驟總結

**已生成金鑰對並完成註冊**（2025-01-29）：
1. ✅ 打開瀏覽器開發者工具（F12）
2. ✅ 貼上 JavaScript 程式碼生成金鑰對
3. ✅ 複製公鑰（Public Key）的 JSON
4. ✅ 確認 JSON 中**沒有 `kid` 欄位**
5. ✅ 在 LINE Developers Console 中貼上公鑰
6. ✅ 點擊 Register 提交
7. ✅ 保存 LINE 自動生成的 `kid`：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126`
8. ⚠️ **立即備份私鑰**（見 [私鑰保管說明](./LINE-AssertionSigningKey-私鑰保管說明.md)）

---

## 💡 提示

- 如果 JSON 太長，可以格式化後再貼上
- 可以使用線上 JSON 驗證工具檢查格式
- 建議先測試 JSON 格式，確認無誤後再提交

