# Apple App ID 設定檢查 - 與 invalid_client 錯誤的關係

## 🔍 問題確認

**是的，App ID 的設定與 `invalid_client` 錯誤有直接關係！**

在 Apple Sign In 的架構中，App ID 和 Services ID 之間有重要的關聯關係，如果 App ID 設定不正確，會導致 Services ID 無法正常工作。

---

## 📋 App ID 與 Services ID 的關係

### 架構說明

```
App ID (com.votechaos.app)
  ├── 用於 iOS App
  ├── 必須啟用 Sign In with Apple
  └── 必須設定為 Primary App ID
       │
       ├── Services ID (com.votechaos.app.services)
       │    ├── 用於 Web Authentication
       │    ├── 必須關聯到 Primary App ID
       │    └── 必須設定 Return URLs
       │
       └── Key (M9U74KGZDA)
            ├── 用於生成 JWT Token
            └── 必須關聯到 Primary App ID
```

### 關鍵關聯

1. **Services ID 必須關聯到 Primary App ID**
   - 在 Services ID 的設定中，必須選擇一個 Primary App ID
   - 如果 App ID 沒有設定為 Primary，Services ID 無法正確關聯

2. **Key 必須關聯到 Primary App ID**
   - 在 Key 的設定中，必須選擇一個 Primary App ID
   - 如果 App ID 沒有設定為 Primary，Key 無法正確關聯

3. **App ID 必須啟用 Sign In with Apple**
   - 如果 App ID 沒有啟用 Sign In with Apple，Services ID 和 Key 都無法使用

---

## 🔧 檢查步驟

### 步驟 1：檢查 App ID 是否存在

1. 前往 [Apple Developer Portal](https://developer.apple.com/)
2. 導航到 **Certificates, Identifiers & Profiles** > **Identifiers**
3. 點擊 **App IDs** 標籤
4. 確認是否存在：
   - **Identifier**：`com.votechaos.app`
   - **Name**：`ChaosRegistry iOS App`（或類似名稱）

**如果不存在，需要先建立 App ID。**

---

### 步驟 2：檢查 App ID 的 Sign In with Apple 設定

1. 在 App IDs 列表中，點擊 `com.votechaos.app`
2. 在 App ID 詳細頁面中，找到 **Capabilities** 區域
3. 找到 **Sign In with Apple** 項目
4. 確認狀態：
   - ✅ 應該顯示「**Enabled**」或「**已啟用**」
   - ✅ 應該有「**Configure**」按鈕

**如果沒有啟用，需要啟用 Sign In with Apple。**

---

### 步驟 3：檢查 App ID 是否設定為 Primary

1. 在 App ID 詳細頁面中，點擊 **Sign In with Apple** 的 **Configure** 按鈕
2. 在彈出視窗中，找到 **Sign In with Apple: App ID Configuration** 區域
3. 檢查是否有以下選項：
   - **Enable as a primary App ID**（啟用為主要 App ID）
   - **Group with an existing primary App ID**（與現有主要 App ID 分組）

4. 確認設定：
   - ✅ **如果這是第一次啟用 Sign In with Apple**：
     - 應該選擇「**Enable as a primary App ID**」
     - 勾選此選項
   - ✅ **如果已經有其他 App ID 設為 Primary**：
     - 可以選擇「**Group with an existing primary App ID**」
     - 從下拉選單中選擇現有的 Primary App ID

**如果 App ID 沒有設定為 Primary，Services ID 和 Key 都無法正確關聯。**

---

### 步驟 4：檢查 Services ID 的 Primary App ID 關聯

1. 前往 **Services IDs** 標籤
2. 點擊 `com.votechaos.app.services`
3. 點擊 **Sign In with Apple** 的 **Configure** 按鈕
4. 在設定頁面中，找到 **Primary App ID** 欄位
5. 確認已選擇：
   - ✅ `com.votechaos.app`
   - ✅ 如果下拉選單中沒有此選項，表示 App ID 沒有正確設定為 Primary

**如果 Services ID 無法選擇正確的 Primary App ID，會導致 `invalid_client` 錯誤。**

---

### 步驟 5：檢查 Key 的 Primary App ID 關聯

1. 前往 **Keys** 頁面
2. 找到 Key ID：`M9U74KGZDA`
3. 點擊進入詳細頁面
4. 在 **Sign In with Apple** 區域，確認 **Primary App ID**：
   - ✅ 應該顯示：`com.votechaos.app`
   - ✅ 如果顯示其他 App ID 或空白，需要重新設定

**如果 Key 沒有關聯到正確的 Primary App ID，生成的 JWT Token 可能無法被 Apple 驗證。**

---

## ⚠️ 常見錯誤

### 錯誤 1：App ID 沒有啟用 Sign In with Apple

**症狀：**
- Services ID 無法選擇 Primary App ID
- Key 無法關聯到 App ID

**解決方案：**
1. 前往 App ID 設定頁面
2. 啟用 **Sign In with Apple**
3. 設定為 **Primary App ID**
4. 重新設定 Services ID 和 Key

---

### 錯誤 2：App ID 沒有設定為 Primary

**症狀：**
- Services ID 的 Primary App ID 下拉選單中沒有 `com.votechaos.app`
- 或顯示錯誤訊息

**解決方案：**
1. 前往 App ID 設定頁面
2. 點擊 **Sign In with Apple** 的 **Configure** 按鈕
3. 選擇「**Enable as a primary App ID**」
4. 點擊 **Save**
5. 重新設定 Services ID 的 Primary App ID

---

### 錯誤 3：Services ID 關聯到錯誤的 App ID

**症狀：**
- Services ID 的 Primary App ID 不是 `com.votechaos.app`
- 或關聯到其他 App ID

**解決方案：**
1. 前往 Services ID 設定頁面
2. 點擊 **Sign In with Apple** 的 **Configure** 按鈕
3. 在 **Primary App ID** 下拉選單中，選擇 `com.votechaos.app`
4. 點擊 **Save**

---

### 錯誤 4：Key 關聯到錯誤的 App ID

**症狀：**
- Key 的 Primary App ID 不是 `com.votechaos.app`
- 生成的 JWT Token 無法被 Apple 驗證

**解決方案：**
1. 前往 Key 設定頁面
2. 點擊 **Sign In with Apple** 的 **Configure** 按鈕
3. 在 **Primary App ID** 下拉選單中，選擇 `com.votechaos.app`
4. 點擊 **Save**
5. **重新生成 JWT Token**（因為 Key 的關聯已改變）

---

## ✅ 完整設定確認清單

請確認以下設定：

### App ID (`com.votechaos.app`)
- [ ] 已建立 App ID
- [ ] 已啟用 Sign In with Apple
- [ ] 已設定為 Primary App ID
- [ ] 沒有錯誤訊息或警告

### Services ID (`com.votechaos.app.services`)
- [ ] 已建立 Services ID
- [ ] 已啟用 Sign In with Apple
- [ ] Primary App ID 已選擇：`com.votechaos.app`
- [ ] Domains and Subdomains：`chaos-registry.vercel.app`
- [ ] Return URLs：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

### Key (`M9U74KGZDA`)
- [ ] 已建立 Key
- [ ] 已啟用 Sign In with Apple
- [ ] Primary App ID 已選擇：`com.votechaos.app`
- [ ] 已下載 `.p8` 檔案
- [ ] 已使用此 Key 生成 JWT Token

### Supabase Apple Provider
- [ ] Client IDs：`com.votechaos.app.services`
- [ ] Secret Key：JWT Token（已驗證簽名成功）
- [ ] Callback URL：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

---

## 🔍 如果仍然有問題

如果確認所有設定都正確但仍然出現 `invalid_client` 錯誤，請：

1. **等待設定生效**：Apple 的設定可能需要幾分鐘才能生效
2. **清除瀏覽器快取**：清除瀏覽器的 cookies 和快取
3. **重新生成 JWT Token**：即使簽名驗證成功，也可以嘗試重新生成
4. **檢查 Supabase Auth Logs**：查看是否有其他錯誤訊息

---

## 📚 參考資料

- [Apple Sign In with Apple - App ID Configuration](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js/configuring_your_webpage_for_sign_in_with_apple)
- [Apple Developer - App IDs](https://developer.apple.com/documentation/appstoreconnectapi/app_ids)
