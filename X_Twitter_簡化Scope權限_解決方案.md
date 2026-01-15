# X (Twitter) 簡化 Scope 權限 - 解決方案

## ❌ 問題

**錯誤訊息**："你無法將存取權授予此應用程式。請返回並嘗試重新登入"

**原因分析**：
- X Developer Portal **沒有「Test users」功能**
- 授權 URL 中的 scope 包含 `tweet.read`，這個權限可能需要應用程式審核
- 應用程式可能尚未通過 X 的審核程序

---

## ✅ 解決方案：簡化 Scope 權限

### 問題根源

從授權 URL 可以看到，當前請求的 scope 包含：
```
scope=users.email+tweet.read+users.read+offline.access
```

其中 `tweet.read` 權限可能需要應用程式審核才能使用。

### 解決方法

**簡化 scope，移除 `tweet.read`**，只保留基本登入所需的權限：
- `users.read` - 讀取用戶基本資訊
- `users.email` - 獲取用戶 email
- `offline.access` - 離線訪問（refresh token）

---

## 🔧 代碼修改

已在 `src/pages/AuthPage.tsx` 中修改 `handleSocialLogin` 函數：

```typescript
const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord' | 'x') => {
  try {
    // X (Twitter) 需要簡化 scope，移除 tweet.read（可能需要審核）
    const oauthOptions: {
      redirectTo: string;
      scopes?: string;
    } = {
      redirectTo: isNative() ? appDeepLinkCallback : `${publicSiteUrl}/home`,
    };

    // 為 X provider 簡化 scope，只使用基本登入權限
    if (provider === 'x') {
      // 移除 tweet.read（可能需要審核），只保留基本登入所需權限
      oauthOptions.scopes = 'users.read users.email offline.access';
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: oauthOptions,
    });
    // ... 錯誤處理
  }
}
```

---

## 📋 修改內容

### 變更說明

1. **為 X provider 添加自定義 scope**：
   - 移除 `tweet.read`（可能需要審核）
   - 只保留 `users.read`, `users.email`, `offline.access`

2. **其他 provider 不受影響**：
   - Google、Apple、Discord 繼續使用 Supabase 預設 scope

---

## 🎯 預期結果

完成修改並重新編譯後，應該能夠：
- ✅ 成功跳轉到 X 授權頁面
- ✅ 授權請求只包含基本登入權限（不包含 `tweet.read`）
- ✅ 成功授權並完成登入
- ✅ 不再出現 "無法授予存取權" 錯誤

---

## 📝 下一步

1. **重新編譯 APP**：
   ```bash
   npm run build
   npm run cap:sync:android
   npm run android
   ```

2. **測試登入**：
   - 完全關閉 APP
   - 重新啟動 APP
   - 點擊 X (Twitter) 登入按鈕
   - 應該能夠成功授權並登入

---

## 💡 如果問題仍然存在

如果簡化 scope 後問題仍然存在，可能的原因：

1. **應用程式需要審核**：
   - 即使只使用基本權限，X 可能仍要求應用程式審核
   - 需要前往 X Developer Portal 提交應用程式審核

2. **應用程式設定問題**：
   - 確認 X Developer Portal 中的所有設定都正確
   - 確認 "Request email from users" 已啟用
   - 確認所有必要的 URL 都已填寫

3. **聯繫 X Developer Support**：
   - 如果所有設定都正確但問題仍然存在
   - 可以聯繫 X Developer Support 尋求協助

---

## 🔍 檢查清單

### X Developer Portal
- [ ] "Request email from users" 已啟用（ON）
- [ ] Type of App 設定為 "Web App, Automated App or Bot"
- [ ] App permissions 至少包含 "Read"
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] Website URL 已設定
- [ ] Terms of service URL 已設定
- [ ] Privacy policy URL 已設定

### Supabase Dashboard
- [ ] X / Twitter (OAuth 2.0) Enabled：ON（綠色/啟用）
- [ ] Client ID 已填入
- [ ] Client Secret 已填入
- [ ] "Allow users without an email" 已勾選

### 代碼
- [x] 使用 `'x'` 作為 provider 名稱（已修正）
- [x] 使用 `handleSocialLogin('x')`（已修正）
- [x] 已移除 Edge Function 調用（已修正）
- [x] 已簡化 scope，移除 `tweet.read`（**本次修改**）

---

**更新日期**：2026-01-14  
**狀態**：已簡化 scope 權限，等待重新編譯和測試
