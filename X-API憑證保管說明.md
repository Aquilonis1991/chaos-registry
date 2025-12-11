# X (Twitter) API 憑證保管說明

> **建立日期**：2025-01-29  
> **重要**：此檔案包含敏感資訊，請妥善保管，不要提交到版本控制系統

---

## ⚠️ 安全提醒

**請務必遵守以下安全原則**：

- ✅ **將憑證保存在安全的位置**
- ✅ **將憑證視為密碼或鑰匙**
- ✅ **如果安全性受到威脅，請立即重新生成憑證**
- ❌ **不要將憑證存儲在公共場所或共享文檔中**
- ❌ **不要將此檔案提交到 Git 或其他版本控制系統**

---

## 📋 X API 憑證資訊

### OAuth 2.0 憑證（用於第三方登入）

#### Client ID
```
R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ
```

#### Client Secret
```
rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG
```

**用途**：用於 Supabase 的 X Provider 設定，實現第三方登入功能。

**設定位置**：
- Supabase Dashboard → Authentication → Providers → X (Twitter)
- Client ID：填入上面的 Client ID
- Client Secret：填入上面的 Client Secret

**重要提醒**：
- ⚠️ Client Secret 只會顯示一次，請妥善保管
- ⚠️ 如果安全性受到威脅，請立即在 X Developer Portal 中重新生成
- ⚠️ 不要將憑證存儲在公共場所或共享文檔中

---

### 舊版 OAuth 2.0 憑證（已過期，僅供參考）

#### API Key (Client ID) - 舊版
```
0nv4g3EWXwjNmxSnRqVjCwkEH
```

#### API Key Secret (Client Secret) - 舊版
```
Cvaj1EH3jbDmFXWt6aQMJFgAZig0LGUcWIgEytGYhiNRJ3JsFh
```

**狀態**：已過期，請使用上方的新版憑證。

---

### Bearer Token

```
AAAAAAAAAAAAAAAAAAAAAPw%2B5wEAAAAATZrR6VQ4qO4UUHgbdzTKEnKObV4%3DdYMQfXbXcImmz6BftUx28gUN662JqfNKswuyK7pUzrJkSdNJCM
```

**URL 解碼後**：
```
AAAAAAAAAAAAAAAAAAAAAPw+5wEAAAAATZrR6VQ4qO4UUHgbdzTKEnKObV4=dYMQfXbXcImmz6BftUx28gUN662JqfNKswuyK7pUzrJkSdNJCM
```

**用途**：用於直接調用 X API，進行應用程式級別的 API 請求（不需要用戶授權）。

**使用方式**：
```http
Authorization: Bearer AAAAAAAAAAAAAAAAAAAAAPw+5wEAAAAATZrR6VQ4qO4UUHgbdzTKEnKObV4=dYMQfXbXcImmz6BftUx28gUN662JqfNKswuyK7pUzrJkSdNJCM
```

---

### OAuth 1.0a 憑證（用於用戶授權的 API 請求）

#### Access Token
```
962903248830021632-npmwDejMf0qLZSrSxuub89Cp88W61J2
```

#### Access Token Secret
```
pSFrJfhCVfIfSe1DSrfFbbFYpWBnXd8fW12yB6rmaKFzj
```

**用途**：用於代表特定用戶進行 API 請求（需要用戶授權）。

**注意**：這些憑證與特定用戶綁定，通常用於需要用戶授權的操作。

---

## 🔐 憑證管理

### 重新生成憑證

如果憑證遺失或安全性受到威脅，請在 X Developer Portal 中重新生成：

1. 登入 [X Developer Portal](https://developer.x.com/)
2. 進入您的專案和應用程式
3. 進入 **「Keys and tokens」** 頁面
4. 點擊 **「Regenerate」** 或 **「Generate」** 按鈕
5. **重要**：重新生成後，舊的憑證將立即失效，請更新所有使用該憑證的地方

### 憑證類型說明

| 憑證類型 | 用途 | 是否需要用戶授權 |
|---------|------|----------------|
| **Client ID** | OAuth 2.0 客戶端識別 | 否（公開） |
| **Client Secret** | OAuth 2.0 客戶端密鑰 | 是（私密） |
| **Bearer Token** | 應用程式級別 API 請求 | 否（應用程式授權） |
| **Access Token** | 用戶級別 API 請求 | 是（用戶授權） |
| **Access Token Secret** | 用戶級別 API 請求密鑰 | 是（用戶授權） |

---

## 📝 在 Supabase 中使用

### 設定 X Provider

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
3. 進入 **Authentication** → **Providers**
4. 找到 **X (Twitter)** 並啟用
5. 填入以下資訊：
   - **Client ID**：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - **Client Secret**：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
6. 點擊 **Save** 儲存

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X Developer Portal](https://developer.x.com/)
- [X API 文件](https://developer.x.com/en/docs)

---

## ⚠️ 最後提醒

**這些憑證是敏感資訊，請務必**：

1. ✅ 保存在安全的位置（例如：密碼管理器）
2. ✅ 不要分享給他人
3. ✅ 不要提交到版本控制系統（Git）
4. ✅ 定期檢查憑證使用情況
5. ✅ 如果發現異常活動，立即重新生成憑證

---

**建立日期**：2025-01-29  
**最後更新**：2025-01-29

