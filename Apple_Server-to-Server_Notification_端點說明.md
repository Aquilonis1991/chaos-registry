# Apple Server-to-Server Notification Endpoint 說明

## 📋 這個端點的作用

**Server-to-Server Notification Endpoint** 用於接收 Apple 發送的重要通知，包括：

### 1. ACCOUNT_DELETE（帳號刪除）
- **觸發時機**：用戶永久刪除 Apple 帳號
- **作用**：自動刪除您系統中對應的用戶帳號
- **重要性**：⭐⭐⭐⭐⭐ **非常重要**

### 2. EMAIL_DISABLED / EMAIL_ENABLED（郵件轉發設定）
- **觸發時機**：用戶禁用或啟用郵件轉發
- **作用**：記錄用戶的郵件轉發設定變更
- **重要性**：⭐⭐⭐ **中等**

### 3. CONSENT_REVOKED（同意撤銷）
- **觸發時機**：用戶撤銷對應用程式的同意
- **作用**：記錄用戶撤銷同意的操作
- **重要性**：⭐⭐⭐ **中等**

---

## ❓ 是否需要填入？

### 選項 1：**建議填入**（推薦）✅

**優點：**
- ✅ 自動處理用戶刪除 Apple 帳號的情況
- ✅ 符合 Apple 的最佳實踐
- ✅ 可以記錄用戶的設定變更
- ✅ 提高系統的完整性

**缺點：**
- ⚠️ 需要先建立和部署 Edge Function
- ⚠️ 需要額外的開發時間

### 選項 2：**暫時留空**（也可以）

**優點：**
- ✅ 不需要額外開發
- ✅ 可以先完成 Apple 登入功能
- ✅ 之後再補上

**缺點：**
- ⚠️ 如果用戶刪除 Apple 帳號，系統不會自動處理
- ⚠️ 需要手動清理已刪除的 Apple 帳號

---

## 🔧 如果選擇填入

### 步驟 1：建立 Edge Function

需要建立 `supabase/functions/apple-notification/index.ts` Edge Function 來處理 Apple 的通知。

**詳細步驟請參考：**
- `Apple_Server-to-Server_Notification_完整設定指南.md`

### 步驟 2：部署 Edge Function

```bash
cd votechaos-main
npx supabase functions deploy apple-notification
```

### 步驟 3：在 Apple Developer Portal 填入

在 **Services ID** > **Sign In with Apple** > **Configure** 中，填入：

```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/apple-notification
```

---

## 📝 目前狀態

根據之前的設定，您已經在 Apple Developer Portal 中填入了：

```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/apple-notification
```

**但是**，根據檢查，這個 Edge Function **尚未建立和部署**。

---

## ⚠️ 重要提醒

### 如果已經填入但 Edge Function 尚未部署：

1. **不會影響 Apple 登入功能**
   - Apple 登入仍然可以正常運作
   - 只是不會收到通知

2. **Apple 可能會發送測試請求**
   - 如果 Edge Function 不存在，會返回 404 錯誤
   - Apple 可能會記錄錯誤，但不影響登入功能

3. **建議做法：**
   - **選項 A**：先留空，等 Edge Function 建立後再填入
   - **選項 B**：先建立和部署 Edge Function，然後再填入

---

## ✅ 建議做法

### 階段 1：先完成 Apple 登入功能（目前）

1. **Server-to-Server Notification Endpoint**：**暫時留空**
2. 先確保 Apple 登入功能正常運作
3. 解決 `invalid_client` 錯誤

### 階段 2：之後再補上（可選）

1. 建立 `apple-notification` Edge Function
2. 部署 Edge Function
3. 在 Apple Developer Portal 中填入端點 URL

---

## 📚 參考資料

- [Apple Sign In with Apple - Server-to-Server Notifications](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user)
- `Apple_Server-to-Server_Notification_完整設定指南.md`（專案內文件）

---

## 🎯 總結

**回答您的問題：**

> Server-to-Server Notification Endpoint 要填入什麼嗎？

**建議：**

1. **目前階段**：**可以暫時留空**
   - 不影響 Apple 登入功能
   - 可以先完成登入功能的設定

2. **之後階段**：**建議填入**
   - 填入：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/apple-notification`
   - 但需要先建立和部署 Edge Function

3. **如果已經填入但 Edge Function 尚未部署**：
   - 可以暫時留空，等 Edge Function 建立後再填入
   - 或先建立 Edge Function，然後再填入

**最重要的是先解決 Apple 登入的 `invalid_client` 錯誤，這個端點可以之後再處理。**
