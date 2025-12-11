# X (Twitter) 登入錯誤除錯指南

> **建立日期**：2025-01-29  
> **錯誤訊息**：`{"error":"請求的路徑無效"}`

---

## 🔍 錯誤分析

### 錯誤訊息
```
{"error":"請求的路徑無效"}
```

這個錯誤通常表示 Supabase 無法識別或處理 X (Twitter) 登入請求。

---

## 🐛 可能原因與解決方案

### 原因 1：Supabase Provider 未啟用或找不到

**症狀**：點擊 Twitter 登入按鈕後出現 "請求的路徑無效" 錯誤，或在 Dashboard 中找不到 X Provider

**解決方案**：

#### 步驟 1：尋找 X Provider

1. **登入 Supabase Dashboard**：
   - 前往 [Supabase Dashboard](https://app.supabase.com/)
   - 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
   - 進入 **Authentication** → **Providers**

2. **搜尋 X Provider**：
   - 在 Providers 列表中向下滾動
   - 使用頁面搜尋功能搜尋 **「X」** 或 **「Twitter」**
   - 查看是否有 **「X (Twitter)」**、**「Twitter」** 或 **「X」** 的選項

3. **如果找不到 Provider**：
   - 檢查 Supabase 專案版本是否為最新
   - 某些舊版本可能不支援 X Provider
   - 嘗試重新整理頁面或清除瀏覽器快取

#### 步驟 2：啟用和設定 Provider

1. **點擊 Provider 卡片**：
   - 找到 X 或 Twitter 的卡片
   - **點擊卡片本身**（不是開關），這會展開詳細設定

2. **啟用 Provider**：
   - 在展開的頁面中找到 **「Enable」** 開關
   - 點擊開關啟用（應該會變成綠色）

3. **填入憑證**：
   - **Client ID / API Key**：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - **Client Secret / API Secret Key**：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
   - 注意：欄位名稱可能因版本而異（Client ID / API Key / OAuth Client ID）

4. **儲存設定**：
   - 點擊 **「Save」** 或 **「Update」** 按鈕
   - 等待幾秒鐘讓設定生效

#### 步驟 3：如果仍然找不到

如果 Dashboard 中完全沒有 X Provider 選項：

1. **檢查 Supabase 版本**：
   - 確認專案是否為最新版本
   - 某些功能可能需要升級

2. **聯繫 Supabase 支援**：
   - 在 Supabase Dashboard 中提交支援請求
   - 說明需要啟用 X (Twitter) Provider 但找不到選項

3. **使用 Supabase CLI**（進階）：
   - 參考 [X 登入設定指南](./X登入設定指南-2025最新版.md) 中的 CLI 方法

---

### 原因 2：Provider 名稱不匹配

**症狀**：Supabase 可能使用不同的 provider 名稱

**檢查**：

1. **確認 Supabase 中的 Provider 名稱**：
   - 在 Supabase Dashboard → Authentication → Providers 中
   - 查看顯示的名稱是 **"X (Twitter)"** 還是 **"Twitter"**

2. **確認前端代碼中的 provider 名稱**：
   - 打開 `src/pages/AuthPage.tsx`
   - 確認 `handleSocialLogin('twitter')` 使用的是 `'twitter'`

3. **可能的解決方案**：
   - 如果 Supabase 顯示的是 **"X"** 而不是 **"Twitter"**，可能需要使用 `'x'` 作為 provider 名稱
   - 但通常 Supabase 仍然支援 `'twitter'` 作為向後兼容

---

### 原因 3：API 憑證錯誤

**症狀**：憑證未正確設定或已過期

**解決方案**：

1. **檢查 Supabase 中的憑證**：
   - 確認 API Key：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - 確認 API Secret Key：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
   - 確認憑證與 X Developer Portal 中的完全一致

2. **重新設定憑證**：
   - 如果憑證不匹配，請在 Supabase 中更新
   - 確認沒有多餘的空格或特殊字元

---

### 原因 4：X Developer Portal 設定不完整

**症狀**：X 端設定有問題

**檢查**：

1. **確認 Callback URI**：
   - 在 X Developer Portal 中
   - 確認 Callback URI 為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - 確認 URL 完全匹配

2. **確認應用程式狀態**：
   - 確認應用程式狀態為 **Active**
   - 確認沒有違規或暫停通知

---

### 原因 5：Supabase 專案配置問題

**症狀**：Supabase 專案設定有問題

**檢查**：

1. **確認專案 URL**：
   - 在 Supabase Dashboard → Settings → API
   - 確認 Project URL 為：`https://epyykzxxglkjombvozhr.supabase.co`

2. **確認 API 設定**：
   - 確認 API 服務正常運行
   - 檢查是否有服務中斷通知

---

## 🔧 除錯步驟

### 步驟 1：檢查 Supabase Provider 狀態

1. 登入 Supabase Dashboard
2. 進入 Authentication → Providers
3. 找到 X (Twitter)
4. 確認：
   - ✅ 開關已啟用
   - ✅ API Key 已填入
   - ✅ API Secret Key 已填入
   - ✅ 沒有錯誤訊息

### 步驟 2：檢查前端代碼

1. 打開 `src/pages/AuthPage.tsx`
2. 確認 `handleSocialLogin` 函數：
   ```typescript
   const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord' | 'line' | 'twitter') => {
     // ...
     const { error } = await supabase.auth.signInWithOAuth({
       provider, // 確認這裡是 'twitter'
       options: {
         redirectTo: redirectUrl,
       },
     });
   }
   ```

### 步驟 3：檢查瀏覽器控制台

1. 在 Android Studio 的 Logcat 中查看詳細錯誤
2. 或在 Chrome DevTools 中查看 Network 請求
3. 查看是否有更詳細的錯誤訊息

### 步驟 4：測試其他 Provider

1. 測試 Google 登入是否正常
2. 如果 Google 正常，問題可能特定於 X Provider
3. 如果所有 Provider 都有問題，可能是 Supabase 配置問題

---

## 🔄 重新設定步驟

如果以上檢查都正常，嘗試重新設定：

### 1. 在 Supabase 中重新設定 X Provider

1. 進入 Supabase Dashboard → Authentication → Providers
2. 找到 X (Twitter)
3. 關閉開關（停用）
4. 等待幾秒鐘
5. 重新啟用開關
6. 重新填入 API Key 和 API Secret Key
7. 確認 "Allow users without an email" 已勾選
8. 點擊 **Save**

### 2. 重新建置和同步

1. 執行 `npm run build`
2. 執行 `npx cap sync android`
3. 在 Android Studio 中重新運行 App

---

## 📝 檢查清單

- [ ] Supabase Dashboard 中 X Provider 已啟用
- [ ] API Key 已正確填入：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
- [ ] API Secret Key 已正確填入：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
- [ ] X Developer Portal 中 Callback URI 已設定
- [ ] X Developer Portal 中應用程式狀態為 Active
- [ ] 前端代碼中使用 `'twitter'` 作為 provider 名稱
- [ ] 已重新建置和同步到 Android

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X 登入設定檢查清單](./X登入設定檢查清單.md)
- [X API 憑證保管說明](./X-API憑證保管說明.md)

---

## 📞 需要更多幫助？

如果問題仍然存在：

1. 檢查 Supabase Dashboard 中的 Authentication Logs
2. 查看 X Developer Portal 中的應用程式日誌
3. 確認 Supabase 和 X API 服務狀態
4. 檢查是否有服務中斷或維護通知

---

**最後更新**：2025-01-29

