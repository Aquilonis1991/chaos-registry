# Supabase LINE 登入設定步驟

> **⚠️ 重要**：Supabase **不直接支援** LINE 作為第三方登入提供者  
> **解決方案**：需要使用自訂實作（Edge Function 或前端直接實作）  
> **更新日期**：2025-01-29  
> **專案資訊**：`votechaos` (epyykzxxglkjombvozhr)

---

## ⚠️ 重要說明

**Supabase 不支援 LINE Provider**：
- Supabase 的 Authentication → Providers 中**沒有 LINE 選項**
- 無法使用 `supabase.auth.signInWithOAuth({ provider: 'line' })`
- 需要自訂實作 LINE OAuth 2.0 流程

**替代方案**：
- ✅ **方案 1**：使用 Supabase Edge Function（推薦）
- ⚠️ **方案 2**：前端直接實作（不推薦，安全性較低）
- 📚 **詳細說明**：請參考 [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md)

---

## 📋 如果您需要實作 LINE 登入

由於 Supabase 不支援 LINE，您需要：

1. **閱讀自訂實作指南**：
   - [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md)

2. **選擇實作方案**：
   - 推薦使用 Supabase Edge Function
   - 或前端直接實作（不推薦）

3. **設定 LINE Developers Console**：
   - 已完成 ✅（Channel ID: `2008600116`）

---

## 🔧 以下內容僅供參考（如果未來 Supabase 支援 LINE）

以下步驟是假設 Supabase 支援 LINE 的情況下的設定步驟。**目前 Supabase 不支援 LINE**，這些步驟無法執行。

---

## 📋 準備資訊

在開始設定前，請確認您已準備好以下資訊：

- ✅ **Channel ID**：`2008600116`
- ✅ **Channel Secret**：`079ebaa784b4c00184e68bafb1841d77`
- ✅ **Supabase Project URL**：`https://epyykzxxglkjombvozhr.supabase.co`
- ✅ **Site URL**：`https://chaos-registry.vercel.app`
- ✅ **Deep Link**：`votechaos://auth/callback`

---

## 🔧 步驟 1：登入 Supabase Dashboard

1. **前往 Supabase Dashboard**
   - 網址：https://app.supabase.com/
   - 使用您的 Supabase 帳號登入

2. **選擇專案**
   - 在專案列表中，選擇專案名稱：`votechaos`
   - 或直接訪問：`https://app.supabase.com/project/epyykzxxglkjombvozhr`

---

## 🔧 步驟 2：設定 URL Configuration

### 2.1 進入 URL Configuration

1. 在左側導航欄，點擊 **「Authentication」**
2. 然後點擊 **「URL Configuration」** 標籤
3. 或直接訪問：`https://app.supabase.com/project/epyykzxxglkjombvozhr/auth/url-configuration`

### 2.2 設定 Site URL

在 **「Site URL」** 欄位中填入：

```
https://chaos-registry.vercel.app
```

**說明**：
- 這是 OAuth 授權完成後的預設重定向網址
- 如果您的正式網站網址不同，請填入實際的網址

### 2.3 設定 Additional Redirect URLs

在 **「Redirect URLs」** 區塊中，點擊 **「Add URL」** 或直接在輸入框中添加以下 URL：

**Web 版**：
```
https://chaos-registry.vercel.app/home
```

**App 版（Deep Link）**：
```
votechaos://auth/callback
```

**說明**：
- 第一行是 Web 版完成登入後的重定向網址
- 第二行是 App 版的 Deep Link（已在專案中實作完成）

### 2.4 儲存設定

點擊 **「Save」** 按鈕儲存設定。

---

## 🔧 步驟 3：啟用 LINE Provider

### 3.1 進入 Providers 設定

1. 在 **Authentication** 頁面中，點擊 **「Providers」** 標籤
2. 或直接訪問：`https://app.supabase.com/project/epyykzxxglkjombvozhr/auth/providers`

### 3.2 找到 LINE Provider

1. 在 Provider 列表中，找到 **「LINE」**
2. 如果找不到，可以使用搜尋功能（在頁面頂部搜尋 "LINE"）
3. 如果還是找不到，請確認您的 Supabase 專案版本是否支援 LINE Provider

### 3.3 進入 LINE Provider 設定頁面

**方法 1：直接點擊 LINE 卡片**
- 點擊 LINE Provider 卡片，進入詳細設定頁面

**方法 2：如果沒有看到卡片**
- 在 Providers 頁面中，查看是否有「Add provider」或「Configure provider」按鈕
- 或直接在瀏覽器訪問：`https://app.supabase.com/project/epyykzxxglkjombvozhr/auth/providers/line`

### 3.4 啟用 LINE Provider

**在 LINE Provider 設定頁面中**：

1. **如果看到「Enable」按鈕或開關**：
   - 點擊 **「Enable」** 按鈕
   - 或切換開關為 **「Enabled」**

2. **如果沒有看到啟用選項**：
   - 這可能是因為需要先填入 Channel ID 和 Channel Secret 才能啟用
   - **請直接跳到步驟 4，先填入憑證**
   - 填入憑證後，Provider 通常會自動啟用，或會出現啟用選項

3. **如果 LINE Provider 不在列表中**：
   - 確認您的 Supabase 專案是否支援 LINE Provider
   - 某些 Supabase 專案可能需要升級或啟用特定功能
   - 如果確實沒有 LINE Provider，可能需要聯繫 Supabase 支援或使用自訂 OAuth 流程

---

## 🔧 步驟 4：填入 LINE OAuth 憑證

### 4.1 進入 LINE Provider 設定頁面

**如果找不到啟用開關，請直接進行此步驟**：

1. **點擊 LINE Provider 卡片**，進入詳細設定頁面
2. 或直接訪問：`https://app.supabase.com/project/epyykzxxglkjombvozhr/auth/providers/line`

**注意**：
- 即使沒有看到「Enable」開關，也可以先填入憑證
- 填入憑證後，Provider 通常會自動啟用
- 或者填入憑證後，啟用選項會出現

### 4.2 填入 Channel ID

1. 在 **「Channel ID」** 欄位中
2. 貼上從 LINE Developers Console 複製的 **Channel ID**
3. **您的 Channel ID**：`2008600116`
4. 格式：`1234567890`（純數字）

**重要**：
- ✅ 請確認 Channel ID 正確無誤
- ✅ 這是您的台灣 Channel ID
- ⚠️ Supabase 只能設定一個 Channel ID（如果有多個地區的 Channel，請選擇主要地區）

### 4.3 填入 Channel Secret

1. 在 **「Channel Secret」** 欄位中
2. 貼上從 LINE Developers Console 複製的 **Channel Secret**
3. **您的 Channel Secret**：`079ebaa784b4c00184e68bafb1841d77`
4. 格式：`abcdefghijklmnopqrstuvwxyz123456789`（字母和數字混合）

**重要**：
- ⚠️ 此欄位會自動隱藏，輸入後只會顯示部分字元（例如：`079ebaa7...`）
- ⚠️ **安全提醒**：Channel Secret 是敏感資訊，請妥善保管
- ✅ 請確認 Channel Secret 正確無誤

### 4.4 設定「Allow users without an email」✅ 建議勾選

1. 在 LINE Provider 設定頁面中，找到 **「Allow users without an email」** 選項
2. **建議勾選此選項** ✅

**原因**：
- LINE 用戶可能沒有驗證 Email
- 如果未勾選，當 LINE 沒有返回 Email 時，用戶登入可能會失敗
- 勾選後，即使 LINE 沒有返回 Email，用戶也能成功登入
- 專案的用戶系統支援沒有 Email 的用戶（使用 nickname 作為識別）

**注意**：
- 即使勾選此選項，如果 LINE 有返回 Email，系統仍會記錄該 Email
- 這不會影響已驗證 Email 的用戶

### 4.5 確認 Scopes（可選）

1. Supabase 預設會使用以下 scopes：
   - `profile`：取得用戶基本資訊（名稱、頭像等）
   - `openid`：OpenID Connect 認證
   - `email`：取得用戶電子郵件（如果用戶已驗證）

2. **通常不需要修改**，使用預設值即可

### 4.6 儲存設定

1. 點擊頁面底部的 **「Save」** 按鈕
2. 或點擊右上角的 **「Save」** 按鈕
3. 儲存成功後，會顯示綠色成功訊息

**重要**：
- 儲存後，LINE Provider 應該會自動啟用
- 如果頁面頂部或側邊有「Enable」開關，確認它已切換為「Enabled」
- 如果沒有看到開關，只要 Channel ID 和 Channel Secret 已正確填入並儲存，Provider 應該已經啟用

---

## ✅ 步驟 5：驗證設定

### 5.1 檢查 Provider 狀態

1. 回到 Providers 列表頁面
2. 確認 LINE Provider 顯示為 **「Enabled」**（綠色開關）

### 5.2 檢查 Redirect URL

1. 在 LINE Provider 設定頁面中
2. 確認 **「Redirect URL」** 顯示為：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
3. **重要**：這應該與您在 LINE Developers Console 中設定的 Callback URL 一致

### 5.3 檢查 Callback URL 一致性

**LINE Developers Console 中的 Callback URLs**：
- ✅ `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- ✅ `votechaos://auth/callback`

**Supabase 中的 Redirect URLs**：
- ✅ `https://chaos-registry.vercel.app/home`
- ✅ `votechaos://auth/callback`

**確認**：
- ✅ LINE Console 和 Supabase 都包含 `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- ✅ LINE Console 和 Supabase 都包含 `votechaos://auth/callback`

---

## 📝 設定摘要

### 已完成的設定

| 項目 | 值 | 狀態 |
|------|-----|------|
| **Site URL** | `https://chaos-registry.vercel.app` | ⏳ 待設定 |
| **Redirect URLs** | `https://chaos-registry.vercel.app/home`<br>`votechaos://auth/callback` | ⏳ 待設定 |
| **LINE Provider** | Enabled | ⏳ 待啟用 |
| **Channel ID** | `2008600116` | ⏳ 待填入 |
| **Channel Secret** | `079ebaa784b4c00184e68bafb1841d77` | ⏳ 待填入 |
| **Allow users without an email** | ✅ 勾選 | ⏳ 待設定 |

---

## ✅ 檢查清單

在完成設定後，請確認以下項目：

### URL Configuration
- [ ] Site URL 已設定：`https://chaos-registry.vercel.app`
- [ ] Redirect URLs 已添加：
  - [ ] `https://chaos-registry.vercel.app/home`
  - [ ] `votechaos://auth/callback`

### LINE Provider ⚠️ Supabase 不支援

**重要**：Supabase **不直接支援** LINE Provider，無法在 Supabase Dashboard 中設定。

**替代方案**：
- [ ] 已閱讀 [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md)
- [ ] 已選擇實作方案（推薦：Supabase Edge Function）
- [ ] Edge Function 已建立：`supabase/functions/line-auth/index.ts`
- [ ] 環境變數已設定：
  - [ ] `LINE_CHANNEL_ID`: `2008600116`
  - [ ] `LINE_CHANNEL_SECRET`: `079ebaa784b4c00184e68bafb1841d77`
  - [ ] `LINE_REDIRECT_URI`: `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
- [ ] Edge Function 已部署到 Supabase
- [ ] 前端程式碼已更新（`handleLineLogin` 函數）
- [ ] LINE 登入功能已測試

**如果未來 Supabase 支援 LINE**（目前不支援）：
- [ ] LINE Provider 已啟用（顯示為 Enabled）
- [ ] Channel ID 已填入：`2008600116`
- [ ] Channel Secret 已填入：`079ebaa784b4c00184e68bafb1841d77`
- [ ] 「Allow users without an email」已勾選 ✅
- [ ] Redirect URL 顯示為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

---

## 🧪 測試 LINE 登入

### Web 版測試

1. 打開瀏覽器，訪問：`https://chaos-registry.vercel.app/auth`
2. 點擊「使用 LINE 登入」按鈕
3. 應該會跳轉到 LINE 登入頁面
4. 使用 LINE 帳號登入並授權應用
5. 登入成功後應該會重定向回應用（`/home`）

### App 版測試（Android/iOS）

1. 在 Android Studio 或 Xcode 中運行 App
2. 在登入頁面點擊「使用 LINE 登入」按鈕
3. 應該會打開瀏覽器或 LINE App，顯示授權頁面
4. 授權後會透過 Deep Link `votechaos://auth/callback` 返回 App
5. App 應該會自動完成登入並導航到 `/home`

---

## ⚠️ 常見問題

### 問題 1：找不到 LINE Provider 啟用開關

**問題**：
- 在 Providers 列表中找不到 LINE Provider
- 或找到 LINE Provider 但沒有看到啟用開關

**解決方案**：

**方案 A：直接進入設定頁面**
1. 點擊 LINE Provider 卡片，進入詳細設定頁面
2. 直接填入 Channel ID 和 Channel Secret
3. 儲存後，Provider 通常會自動啟用

**方案 B：檢查 Supabase 版本**
1. 確認您的 Supabase 專案是否支援 LINE Provider
2. 某些舊版本的 Supabase 可能不支援 LINE
3. 如果確實沒有 LINE Provider，可能需要：
   - 升級 Supabase 專案
   - 或使用自訂 OAuth 流程（需要額外開發）

**方案 C：使用直接連結**
- 嘗試直接訪問：`https://app.supabase.com/project/epyykzxxglkjombvozhr/auth/providers/line`
- 如果可以直接訪問，說明 Provider 存在，只是介面顯示不同

**確認是否啟用**：
- 填入 Channel ID 和 Channel Secret 並儲存後
- 回到 Providers 列表頁面
- 如果 LINE Provider 顯示為「Enabled」或綠色狀態，表示已啟用
- 或者直接測試 LINE 登入功能，如果可以使用，表示已啟用

### 問題 2：重定向 URI 不匹配

**錯誤訊息**：`redirect_uri_mismatch`

**解決方案**：
1. 確認在 LINE Developers Console 中配置的 Callback URL 與 Supabase 專案 URL 完全匹配
2. 格式必須是：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
3. 確認 Deep Link `votechaos://auth/callback` 也已在 LINE Developers Console 中添加

### 問題 3：Channel ID 或 Channel Secret 錯誤

**錯誤訊息**：`invalid_client` 或其他認證失敗訊息

**解決方案**：
1. 確認 Channel ID 和 Channel Secret 已正確複製（沒有多餘空格）
2. 確認在 Supabase Dashboard 中填入的是 Channel ID（不是 Provider ID）
3. 如果 Channel Secret 遺失，需要在 LINE Developers Console 中重新產生

### 問題 4：LINE 登入後沒有 Email

**解決方案**：
1. 確認已勾選 **「Allow users without an email」** 選項
2. 確認 LINE 用戶已驗證 Email（在 LINE 設定中）
3. 確認 LINE Login Channel 已啟用 OpenID Connect（在 LINE Developers Console 中）

---

## 🔗 相關文件

- [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md) ⚠️ **重要：Supabase 不支援 LINE，需要自訂實作**
- [LINE 第三方登入完整設定指南](./LINE第三方登入完整設定指南.md)
- [LINE Email 權限申請指南](./LINE-Email權限申請指南.md)
- [Deep Link 設定完成報告](./DeepLink設定完成報告.md)

---

## 📞 需要幫助？

如果遇到問題：
1. 檢查上述檢查清單中的所有項目
2. 查看 [LINE 第三方登入完整設定指南](./LINE第三方登入完整設定指南.md) 中的「常見問題與排錯」部分
3. 確認 LINE Developers Console 和 Supabase 的設定是否一致

---

**設定完成後，您就可以在應用程式中使用 LINE 登入了！** 🎉

