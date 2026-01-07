# Discord 登入 - 帳號連結說明

## 📋 問題情境

當用戶使用 Discord 登入時，如果 Discord 帳號的 Email 與已經註冊的某個帳號（例如：Email/Password 註冊）所使用的 Email 相同，會發生什麼？

---

## 🔍 Supabase 的預設行為

### 情況 1：Email 已存在且已驗證

**預設行為**：
- Supabase 會**自動連結** Discord 認證方式到現有帳號
- 用戶會使用**現有帳號**登入（不是創建新帳號）
- 用戶的資料（代幣、投票記錄等）會保留

**前提條件**：
- 需要在 Supabase Dashboard 中啟用「Account Linking」功能
- 現有帳號的 Email 必須已經驗證（`email_confirmed_at` 不為 null）

### 情況 2：Email 已存在但未驗證

**預設行為**：
- 可能會創建**新帳號**（取決於 Supabase 設定）
- 或者顯示錯誤訊息（如果啟用了「Prevent duplicate emails」）

### 情況 3：Email 不存在

**預設行為**：
- 創建**新帳號**
- 使用 Discord 提供的 Email 和用戶資訊

---

## ⚙️ Supabase Dashboard 設定

### 1. 啟用帳號連結（Account Linking）

**位置**：`Supabase Dashboard > Authentication > Settings > Account Linking`

**選項**：
- ✅ **Enable account linking**：啟用後，允許將多個認證方式（Email/Password、Discord、Google 等）連結到同一個帳號
- ⚠️ **Prevent duplicate emails**：啟用後，如果 Email 已存在，會阻止創建新帳號

**建議設定**：
```
✅ Enable account linking: ON
⚠️ Prevent duplicate emails: ON（建議啟用，避免重複帳號）
```

### 2. 檢查當前設定

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇您的專案：`votechaos` (epyykzxxglkjombvozhr)
3. 導航到 **Authentication** > **Settings**
4. 查看 **Account Linking** 區塊

---

## 🔄 帳號連結流程

### 流程圖

```
用戶點擊 Discord 登入
    ↓
Discord 授權成功
    ↓
Supabase 收到 OAuth 回調（包含 Email）
    ↓
檢查 Email 是否已存在？
    ├─ 否 → 創建新帳號 ✅
    │
    └─ 是 → Email 是否已驗證？
            ├─ 是 → 自動連結到現有帳號 ✅
            │       （用戶使用現有帳號登入）
            │
            └─ 否 → 根據設定決定：
                    ├─ 創建新帳號（如果未啟用 Prevent duplicate emails）
                    └─ 顯示錯誤（如果啟用了 Prevent duplicate emails）
```

### 實際範例

**範例 1：成功連結**
1. 用戶 A 使用 `user@example.com` 和密碼註冊了帳號
2. 用戶 A 驗證了 Email
3. 用戶 A 使用 Discord 登入（Discord Email 也是 `user@example.com`）
4. **結果**：Discord 認證方式自動連結到現有帳號，用戶 A 使用同一個帳號登入

**範例 2：創建新帳號**
1. 用戶 B 使用 `user2@example.com` 和密碼註冊了帳號
2. 用戶 B **未驗證** Email
3. 用戶 B 使用 Discord 登入（Discord Email 也是 `user2@example.com`）
4. **結果**：可能創建新帳號（取決於設定），導致有兩個帳號使用同一個 Email

**範例 3：錯誤訊息**
1. 用戶 C 使用 `user3@example.com` 和密碼註冊了帳號
2. 用戶 C **未驗證** Email
3. 啟用了「Prevent duplicate emails」
4. 用戶 C 使用 Discord 登入（Discord Email 也是 `user3@example.com`）
5. **結果**：顯示錯誤訊息「Email already exists」

---

## 🛠️ 如何處理這種情況

### 方案 1：啟用帳號連結（推薦）✅

**優點**：
- 用戶體驗最佳：自動連結，無需額外操作
- 避免重複帳號
- 用戶可以使用多種方式登入同一個帳號

**設定步驟**：
1. Supabase Dashboard > Authentication > Settings
2. 啟用 **Enable account linking**
3. 啟用 **Prevent duplicate emails**（可選，但建議）

### 方案 2：手動處理（如果需要自訂邏輯）

如果需要在應用程式中自訂處理邏輯，可以在 OAuth 回調處理中添加檢查：

```typescript
// 在 OAuthCallbackHandler.tsx 中
const { data: { session }, error } = await supabase.auth.setSession({
  access_token: params.access_token,
  refresh_token: params.refresh_token
});

if (error) {
  // 檢查是否為 Email 已存在錯誤
  if (error.message.includes('already registered') || error.message.includes('duplicate')) {
    // 提示用戶使用 Email/Password 登入，或提供連結帳號的選項
    toast.error('此 Email 已註冊，請使用 Email/Password 登入');
    navigate('/auth', { replace: true });
    return;
  }
}
```

### 方案 3：提供帳號連結 UI

在用戶設定頁面提供「連結 Discord 帳號」功能：

```typescript
// 在 ProfilePage.tsx 中
const linkDiscordAccount = async () => {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'discord'
  });
  
  if (error) {
    if (error.message.includes('already linked')) {
      toast.info('Discord 帳號已連結');
    } else {
      toast.error('連結失敗：' + error.message);
    }
  } else {
    toast.success('Discord 帳號連結成功！');
  }
};
```

---

## 📊 檢查帳號連結狀態

### 在 Supabase Dashboard 中

1. **Authentication** > **Users**
2. 選擇用戶
3. 查看 **Identities** 區塊
4. 可以看到該用戶連結的所有認證方式（Email/Password、Discord、Google 等）

### 在應用程式中

```typescript
const { data: { user } } = await supabase.auth.getUser();

// 檢查用戶的認證方式
const identities = user?.identities || [];
const hasDiscord = identities.some(id => id.provider === 'discord');
const hasEmail = identities.some(id => id.provider === 'email');

console.log('認證方式：', {
  email: hasEmail,
  discord: hasDiscord,
  all: identities.map(id => id.provider)
});
```

---

## ⚠️ 注意事項

### 1. Email 驗證的重要性

- 只有**已驗證的 Email** 才能自動連結
- 未驗證的 Email 可能會導致創建重複帳號

### 2. 用戶體驗

- 如果啟用了帳號連結，用戶可能不知道 Discord 登入會連結到現有帳號
- 建議在 UI 中提示：「如果此 Email 已註冊，將自動連結到現有帳號」

### 3. 安全性

- 帳號連結需要 Email 驗證，這是安全機制
- 如果未啟用「Prevent duplicate emails」，可能會創建重複帳號

---

## 🔗 相關文件

- [Supabase Account Linking 官方文件](https://supabase.com/docs/guides/auth/auth-account-linking)
- [Discord 第三方登入完整設定指南](./Discord第三方登入完整設定指南.md)
- [第三方登入共用設定](./第三方登入共用設定.md)

---

## 📝 總結

**目前專案的預設行為**：
- 如果 Discord Email 與現有帳號 Email 相同，且現有帳號 Email 已驗證
- Supabase 會**自動連結** Discord 到現有帳號
- 用戶會使用**現有帳號**登入，保留所有資料

**建議**：
1. ✅ 在 Supabase Dashboard 中啟用「Account Linking」
2. ✅ 啟用「Prevent duplicate emails」避免重複帳號
3. ✅ 確保用戶驗證 Email（Email/Password 註冊時）
4. ⚠️ 考慮在 UI 中提示帳號連結行為




