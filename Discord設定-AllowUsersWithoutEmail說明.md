# Discord OAuth 設定：Allow users without an email

## 📋 選項說明

在 Supabase Dashboard → Authentication → Providers → Discord 設定頁面中，有一個選項：

**「Allow users without an email」**

### 選項功能

- **勾選**：允許用戶在 Discord 沒有返回 Email 時也能成功登入
- **不勾選**：如果 Discord 沒有返回 Email，用戶登入可能會失敗

---

## ✅ 建議：勾選此選項

### 為什麼建議勾選？

1. **Discord 用戶可能沒有驗證 Email**
   - 不是所有 Discord 用戶都會驗證 Email
   - 如果未勾選，這些用戶將無法登入

2. **提升用戶體驗**
   - 勾選後，更多用戶可以成功使用 Discord 登入
   - 減少登入失敗的情況

3. **專案已支援沒有 Email 的用戶**
   - 專案的用戶系統使用 `nickname` 作為主要識別
   - `handle_new_user` 函數會處理沒有 Email 的情況
   - 用戶可以正常使用所有功能

4. **Email 仍會被記錄（如果有）**
   - 即使勾選此選項，如果 Discord 有返回 Email，系統仍會記錄
   - 只是允許沒有 Email 的用戶也能登入

---

## 🔧 設定步驟

1. **前往 Supabase Dashboard**
   - 訪問：https://app.supabase.com/project/epyykzxxglkjombvozhr/auth/providers
   - 點擊 **Discord** Provider

2. **找到「Allow users without an email」選項**
   - 在 Discord Provider 設定頁面中
   - 通常位於 Client ID 和 Client Secret 欄位下方

3. **勾選此選項** ✅
   - 點擊核取方塊，勾選 **「Allow users without an email」**

4. **儲存設定**
   - 點擊 **「Save」** 按鈕
   - 確認設定已儲存

---

## 📝 注意事項

### 如果未勾選會發生什麼？

- 當 Discord 用戶沒有驗證 Email 時，登入可能會失敗
- 用戶會看到錯誤訊息，無法完成登入流程
- 這會導致部分 Discord 用戶無法使用您的服務

### 如果勾選會發生什麼？

- 所有 Discord 用戶（無論是否有 Email）都能成功登入
- 有 Email 的用戶：Email 會被記錄在 `auth.users.email` 欄位
- 沒有 Email 的用戶：`auth.users.email` 可能為 `null`，但用戶仍可正常使用服務

---

## 🧪 測試建議

### 測試場景 1：有 Email 的 Discord 用戶
1. 使用已驗證 Email 的 Discord 帳號登入
2. 確認登入成功
3. 在 Supabase Dashboard → Authentication → Users 中確認 Email 已記錄

### 測試場景 2：沒有 Email 的 Discord 用戶
1. 使用未驗證 Email 的 Discord 帳號登入
2. 確認登入成功（如果已勾選「Allow users without an email」）
3. 在 Supabase Dashboard → Authentication → Users 中確認用戶已建立，但 Email 可能為 `null`

---

## ✅ 結論

**建議勾選「Allow users without an email」選項**

這樣可以：
- ✅ 讓更多 Discord 用戶成功登入
- ✅ 提升用戶體驗
- ✅ 減少登入失敗的情況
- ✅ 專案已支援沒有 Email 的用戶，不會影響功能使用

---

**相關文件**：
- [Discord 第三方登入完整設定指南](./Discord第三方登入完整設定指南.md)


