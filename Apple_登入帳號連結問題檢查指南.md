# Apple 登入帳號連結問題檢查指南

## 🔍 問題描述

使用 Apple 帳號登入後，沒有正確進入同 Email 的帳號。

## 📋 可能的原因

### 1. Apple 的「隱藏我的 Email」功能

當用戶選擇「**隱藏我的 Email**」時：
- Apple 會提供一個代理 Email（例如：`xxxxx@privaterelay.appleid.com`）
- 這個代理 Email 與原本的 Email 不同
- 導致無法匹配到現有帳號

### 2. Supabase 帳號連結設定

Supabase 預設會根據 Email 自動連結相同 Email 的帳號，但需要正確設定。

### 3. Email 格式不一致

- 原本帳號的 Email：`user@example.com`
- Apple 返回的 Email：`user@example.com` 或 `xxxxx@privaterelay.appleid.com`
- 如果格式不一致，無法匹配

---

## 🔧 解決方案

### 步驟 1：檢查 Supabase Apple Provider 設定

#### 1.1 前往 Supabase Dashboard

1. 開啟瀏覽器，前往：https://app.supabase.com/
2. 使用您的帳號登入
3. 選擇專案：`epyykzxxglkjombvozhr`

#### 1.2 檢查 Apple Provider 設定

1. 導航到：**Authentication** > **Providers** > **Apple**
2. 點擊「**Configure**」按鈕
3. 檢查以下設定：

**Allow users without an email**：
- ✅ **必須已勾選**
- 這允許用戶選擇隱藏郵件地址時仍能登入
- 但這不會解決帳號連結問題

**Account Linking**（如果有的話）：
- 檢查是否有帳號連結相關設定
- Supabase 預設會根據 Email 自動連結

#### 1.3 檢查 Supabase 帳號連結設定

**重要**：Supabase 預設會根據 Email 自動連結相同 Email 的帳號，這是內建功能，不需要額外設定。

如果帳號沒有自動連結，可能的原因：
1. Email 不一致（例如：用戶選擇了「隱藏我的 Email」）
2. Email 格式不同（大小寫、空格等）
3. 帳號已存在但 Email 不同

**不需要檢查額外設定**，Supabase 會自動處理帳號連結。

---

### 步驟 2：檢查用戶的 Email 狀態

#### 2.1 檢查 Apple 登入返回的 Email

1. 在 Supabase Dashboard，導航到：**Authentication** > **Users**
2. 找到使用 Apple 登入的用戶
3. 檢查用戶的 Email：
   - 如果是 `xxxxx@privaterelay.appleid.com`，表示用戶選擇了「隱藏我的 Email」
   - 如果是真實 Email，應該可以匹配

#### 2.2 檢查現有帳號的 Email

1. 在 **Authentication** > **Users** 中
2. 找到原本的帳號（使用其他方式登入的帳號）
3. 檢查 Email 是否與 Apple 登入的 Email 一致

---

### 步驟 3：手動連結帳號（如果需要）

如果自動連結失敗，可以手動連結：

#### 3.1 在 Supabase Dashboard 中連結

1. 導航到：**Authentication** > **Users**
2. 找到需要連結的兩個帳號
3. 點擊其中一個帳號進入詳細頁面
4. 找到「**Link Account**」或「**Merge Account**」選項
5. 選擇另一個帳號進行連結

#### 3.2 使用 Supabase Admin API 連結

如果需要程式化連結，可以使用 Supabase Admin API。

---

### 步驟 4：檢查前端代碼

#### 4.1 檢查登入後的處理邏輯

檢查 `src/contexts/AuthContext.tsx` 和 `src/pages/AuthPage.tsx`：
- 登入後是否有檢查現有帳號的邏輯
- 是否有處理帳號連結的邏輯

#### 4.2 檢查 Email 處理

檢查 Apple 登入返回的 Email 是否正確處理：
- 是否正確取得 Email
- 是否正確匹配現有帳號

---

## 🎯 最佳實踐

### 1. 啟用「Allow users without an email」

在 Supabase Apple Provider 設定中：
- ✅ 啟用「Allow users without an email」
- 這允許用戶選擇隱藏郵件地址時仍能登入

### 2. 啟用帳號連結

在 Supabase Authentication 設定中：
- ✅ 啟用「Link accounts with same email」
- 這會自動將相同 Email 的帳號連結

### 3. 處理「隱藏我的 Email」情況

如果用戶選擇「隱藏我的 Email」：
- Apple 會提供代理 Email（`xxxxx@privaterelay.appleid.com`）
- 這個 Email 無法匹配到現有帳號
- 需要用戶手動連結，或使用其他方式識別用戶

---

## 🔍 診斷步驟

### 步驟 1：檢查用戶 Email

1. 在 Supabase Dashboard > **Authentication** > **Users**
2. 找到使用 Apple 登入的用戶
3. 檢查 Email 欄位：
   - 如果是真實 Email：應該可以自動連結
   - 如果是代理 Email（`@privaterelay.appleid.com`）：無法自動連結

### 步驟 2：檢查現有帳號

1. 在 **Authentication** > **Users** 中
2. 搜尋原本帳號的 Email
3. 確認 Email 是否與 Apple 登入的 Email 一致

### 步驟 3：檢查帳號連結狀態

1. 在用戶詳細頁面中
2. 檢查「**Linked Accounts**」或「**Identities**」
3. 確認是否有連結到其他帳號

---

## ⚠️ 常見問題

### 問題 1：用戶選擇「隱藏我的 Email」

**原因**：
- Apple 提供代理 Email，無法匹配現有帳號

**解決方案**：
- 無法自動連結
- 需要用戶手動連結，或使用其他方式識別用戶
- 建議在登入流程中提示用戶不要選擇「隱藏我的 Email」

### 問題 2：Email 格式不一致

**原因**：
- 原本帳號的 Email：`user@example.com`
- Apple 返回的 Email：`User@Example.com`（大小寫不同）

**解決方案**：
- Supabase 通常會自動處理大小寫，但建議統一使用小寫

### 問題 3：帳號連結未啟用

**原因**：
- Supabase 的帳號連結功能未啟用

**解決方案**：
- 在 Supabase Dashboard > **Authentication** > **Settings** 中啟用

---

## 📝 檢查清單

### Supabase 設定
- [ ] **Allow users without an email**：已勾選
- [ ] **Account Linking**：已啟用
- [ ] **Link accounts with same email**：已啟用

### 用戶檢查
- [ ] Apple 登入用戶的 Email 已檢查
- [ ] 現有帳號的 Email 已檢查
- [ ] Email 是否一致已確認

### 帳號連結
- [ ] 自動連結是否成功已檢查
- [ ] 如果需要，手動連結已執行

---

## 🧪 測試步驟

### 測試 1：使用相同 Email 登入

1. 使用 Google 或其他方式註冊帳號（Email：`test@example.com`）
2. 登出
3. 使用 Apple 登入（使用相同的 Email：`test@example.com`）
4. 確認是否進入同一個帳號

### 測試 2：使用「隱藏我的 Email」

1. 使用 Apple 登入
2. 選擇「**隱藏我的 Email**」
3. 確認是否建立新帳號（因為無法匹配）

---

## 📞 需要協助？

如果按照以上步驟檢查後仍有問題，請告訴我：
1. Apple 登入用戶的 Email 是什麼？
2. 現有帳號的 Email 是什麼？
3. 是否選擇了「隱藏我的 Email」？
4. Supabase 的帳號連結設定是什麼？

我可以協助您進一步診斷和解決問題。
