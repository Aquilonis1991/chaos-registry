# LINE 登入 - Edge Function 實作詳細步驟

> **方案**：使用 Supabase Edge Function 實作 LINE 登入  
> **更新日期**：2025-01-29  
> **專案資訊**：`votechaos` (epyykzxxglkjombvozhr)

---

## 📋 準備資訊

在開始之前，請確認您已準備好以下資訊：

- ✅ **LINE Channel ID**：`2008600116`
- ✅ **LINE Channel Secret**：`079ebaa784b4c00184e68bafb1841d77`
- ✅ **Supabase Project URL**：`https://epyykzxxglkjombvozhr.supabase.co`
- ✅ **Frontend URL**：`https://chaos-registry.vercel.app`
- ✅ **Deep Link**：`votechaos://auth/callback`

---

## 🚀 快速開始（步驟摘要）

**已完成的工作**：
- ✅ 資料庫 Migration 檔案已建立：`supabase/migrations/20250129000000_add_line_user_id_to_profiles.sql`
- ✅ Edge Function 程式碼已建立：`supabase/functions/line-auth/index.ts`
- ✅ 前端程式碼已更新：`src/pages/AuthPage.tsx`

**您需要執行**：
1. ⏳ **步驟 1**：執行資料庫 Migration
2. ⏳ **步驟 3**：設定環境變數（在 Supabase Dashboard）
3. ⏳ **步驟 4**：部署 Edge Function
4. ⏳ **步驟 5**：更新 LINE Developers Console（添加 Callback URL）
5. ⏳ **步驟 8**：測試功能

**預計時間**：約 15-30 分鐘

---

## 🔧 步驟 1：執行資料庫 Migration

### 1.1 確認 Migration 檔案

確認以下檔案已建立：
- `supabase/migrations/20250129000000_add_line_user_id_to_profiles.sql`

### 1.2 執行 Migration

**方法 1：使用 Supabase CLI（推薦）**

```bash
# 進入專案目錄
cd votechaos-main

# 登入 Supabase（如果尚未登入）
npx supabase login

# 連結專案
npx supabase link --project-ref epyykzxxglkjombvozhr

# 執行 migration
npx supabase db push
```

**方法 2：在 Supabase Dashboard 中執行**

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
3. 進入 **SQL Editor**
4. 複製 `20250129000000_add_line_user_id_to_profiles.sql` 的內容
5. 貼上並執行 SQL

### 1.3 驗證 Migration

執行以下 SQL 確認欄位已添加：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'line_user_id';
```

應該會看到 `line_user_id` 欄位。

---

## 🔧 步驟 2：建立 Edge Function

### 2.1 確認 Edge Function 檔案

確認以下檔案已建立：
- `supabase/functions/line-auth/index.ts`

### 2.2 檢查檔案內容

Edge Function 應該包含：
- ✅ 處理 `/auth` 端點（生成 LINE 授權 URL）
- ✅ 處理 `/callback` 端點（處理 LINE 回調）
- ✅ 與 Supabase Auth 整合
- ✅ 建立或更新用戶

---

## 🔧 步驟 3：設定環境變數

### 3.1 進入 Supabase Dashboard

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
3. 進入 **Project Settings** → **Edge Functions**

### 3.2 添加環境變數

在 **Secrets** 區塊中，添加以下環境變數：

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `LINE_CHANNEL_ID` | `2008600116` | LINE Channel ID |
| `LINE_CHANNEL_SECRET` | `079ebaa784b4c00184e68bafb1841d77` | LINE Channel Secret |
| `LINE_REDIRECT_URI` | `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback` | LINE 回調 URL |
| `FRONTEND_URL` | `https://chaos-registry.vercel.app` | 前端網站 URL |
| `FRONTEND_DEEP_LINK` | `votechaos://auth/callback` | App Deep Link |

**注意**：
- `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 通常會自動設定
- `SERVICE_ROLE_KEY` 需要手動添加（用於建立用戶）
- ⚠️ **重要**：環境變數名稱**不能以 `SUPABASE_` 開頭**，所以使用 `SERVICE_ROLE_KEY` 而不是 `SUPABASE_SERVICE_ROLE_KEY`

### 3.3 取得 Service Role Key

1. 在 Supabase Dashboard 中，進入 **Project Settings** → **API**
2. 找到 **Service Role Key**（⚠️ 這是敏感資訊，請妥善保管）
3. 複製 Service Role Key
4. 在 Edge Functions 的 Secrets 中添加：
   - 變數名稱：`SERVICE_ROLE_KEY`（⚠️ 不能使用 `SUPABASE_SERVICE_ROLE_KEY`）
   - 值：貼上 Service Role Key

---

## 🔧 步驟 4：部署 Edge Function

### 4.1 確認 Supabase CLI 已安裝

```bash
# 檢查 Supabase CLI 版本
npx supabase --version
```

如果沒有安裝，會自動下載。

### 4.2 登入 Supabase

```bash
# 進入專案目錄
cd votechaos-main

# 登入 Supabase（如果尚未登入）
npx supabase login
```

這會打開瀏覽器，要求您登入 Supabase 帳號。

### 4.3 連結專案

```bash
# 連結專案（如果尚未連結）
npx supabase link --project-ref epyykzxxglkjombvozhr
```

**注意**：如果已經連結過，會顯示 "Project already linked"。

### 4.4 部署 Edge Function

```bash
# 部署 Edge Function
npx supabase functions deploy line-auth
```

**部署過程**：
1. CLI 會上傳 Edge Function 程式碼
2. 設定環境變數（從 Supabase Dashboard 讀取）
3. 部署到 Supabase 平台

**部署成功後**，您應該看到：
```
Deploying function line-auth...
Function line-auth deployed successfully
```

### 4.5 驗證部署

**測試授權端點**：
```bash
curl https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/auth
```

**預期回應**：
```json
{
  "authUrl": "https://access.line.me/oauth2/v2.1/authorize?...",
  "state": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**如果出現錯誤**：
- 檢查環境變數是否已設定
- 檢查 Edge Function 日誌（Supabase Dashboard → Edge Functions → Logs）

---

## 🔧 步驟 5：更新 LINE Developers Console

### 5.1 確認 Callback URL

在 LINE Developers Console 中，確認 Callback URL 包含：

```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
```

**步驟**：
1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇 Provider：`ChaosRegistry`
3. 選擇 Channel：`2008600116`
4. 進入 **LINE Login** 設定
5. 在 **Callback URL** 中，確認包含上述 URL
6. 如果沒有，點擊 **「Add」** 添加

---

## 🔧 步驟 6：更新前端程式碼

### 6.1 確認檔案已更新

**已更新的檔案**：
- ✅ `src/pages/AuthPage.tsx` - 已添加 `handleLineLogin` 函數和 LINE 回調處理

**更新內容**：
1. ✅ 添加 `handleLineLogin` 函數（呼叫 Edge Function）
2. ✅ 更新 `handleSocialLogin` 函數（LINE 使用自訂處理）
3. ✅ 添加 LINE 回調處理邏輯（處理 URL 參數中的 token）

### 6.2 驗證更新

**檢查 `src/pages/AuthPage.tsx`**：

1. **確認 `handleLineLogin` 函數存在**：
   ```typescript
   const handleLineLogin = async () => {
     // ... 呼叫 Edge Function 取得 LINE 授權 URL
   }
   ```

2. **確認 `handleSocialLogin` 已更新**：
   ```typescript
   if (provider === 'line') {
     return handleLineLogin()
   }
   ```

3. **確認 LINE 回調處理存在**：
   ```typescript
   useEffect(() => {
     // ... 處理 URL 參數中的 LINE token
   }, [navigate])
   ```

### 6.3 如果檔案未更新

如果檔案沒有自動更新，請手動檢查並確認上述內容已存在。

### 6.3 處理 LINE 回調（已完成）✅

**說明**：Edge Function 會處理 LINE 回調並重定向到前端，前端會自動處理 URL 參數中的 token。

**已更新的檔案**：
- ✅ `src/pages/AuthPage.tsx` - 已添加 LINE 回調處理邏輯

**處理流程**：
1. Edge Function 處理 LINE OAuth 回調
2. 建立或更新 Supabase 用戶
3. 生成 magic link 並提取 token
4. 重定向到前端（Web 版：`/auth/callback`，App 版：Deep Link）
5. 前端使用 token 設定 session
6. 導航到首頁

**前端處理邏輯**（已在 `AuthPage.tsx` 中實作）：
- 檢查 URL 參數中的 `provider=line`
- 使用 `access_token` 和 `refresh_token` 設定 session
- 顯示成功訊息並導航到首頁

---

## 🔧 步驟 7：更新 OAuthCallbackHandler

如果專案中有 `OAuthCallbackHandler` 組件，需要更新以處理 LINE 回調。

**檢查 `src/components/OAuthCallbackHandler.tsx`**：

如果存在，確保它能處理來自 Edge Function 的重定向。

---

## ✅ 步驟 8：測試

### 8.1 Web 版測試

1. 打開瀏覽器，訪問：`https://chaos-registry.vercel.app/auth`
2. 點擊「使用 LINE 登入」按鈕
3. 應該會跳轉到 LINE 授權頁面
4. 使用 LINE 帳號登入並授權應用
5. 應該會重定向回應用並完成登入

### 8.2 App 版測試（Android/iOS）

1. 在 Android Studio 或 Xcode 中運行 App
2. 在登入頁面點擊「使用 LINE 登入」按鈕
3. 應該會打開瀏覽器，顯示 LINE 授權頁面
4. 授權後會透過 Deep Link `votechaos://auth/callback` 返回 App
5. App 應該會自動完成登入

### 8.3 檢查日誌

**Edge Function 日誌**：
1. 在 Supabase Dashboard 中，進入 **Edge Functions** → **line-auth** → **Logs**
2. 查看是否有錯誤訊息

**前端日誌**：
1. 打開瀏覽器開發者工具（F12）
2. 查看 Console 中的日誌

---

## ⚠️ 常見問題

### 問題 1：Edge Function 部署失敗

**錯誤訊息**：`Function deployment failed`

**解決方案**：
1. 確認已登入 Supabase CLI：`npx supabase login`
2. 確認專案已連結：`npx supabase link --project-ref epyykzxxglkjombvozhr`
3. 檢查 Edge Function 程式碼是否有語法錯誤
4. 確認環境變數已設定

### 問題 2：LINE 回調失敗

**錯誤訊息**：`redirect_uri_mismatch`

**解決方案**：
1. 確認 LINE Developers Console 中的 Callback URL 為：
   `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
2. 確認 Edge Function 中的 `LINE_REDIRECT_URI` 環境變數與上述 URL 一致

### 問題 3：無法建立用戶

**錯誤訊息**：`Failed to create user`

**解決方案**：
1. 確認 `SERVICE_ROLE_KEY` 環境變數已設定（⚠️ 不是 `SUPABASE_SERVICE_ROLE_KEY`）
2. 確認 Service Role Key 正確無誤
3. 檢查 Edge Function 日誌中的詳細錯誤訊息

### 問題 4：Session 設定失敗

**解決方案**：
1. 確認 Edge Function 返回的 token 格式正確
2. 檢查前端程式碼中的 session 設定邏輯
3. 可能需要調整 token 處理方式

---

## 📝 檢查清單

### 資料庫
- [ ] Migration 已執行：`20250129000000_add_line_user_id_to_profiles.sql`
- [ ] `profiles` 表已添加 `line_user_id` 欄位
- [ ] 索引已建立

### Edge Function
- [ ] Edge Function 檔案已建立：`supabase/functions/line-auth/index.ts`
- [ ] 環境變數已設定：
  - [ ] `LINE_CHANNEL_ID`
  - [ ] `LINE_CHANNEL_SECRET`
  - [ ] `LINE_REDIRECT_URI`
  - [ ] `FRONTEND_URL`
  - [ ] `FRONTEND_DEEP_LINK`
  - [ ] `SERVICE_ROLE_KEY`（⚠️ 不是 `SUPABASE_SERVICE_ROLE_KEY`）
- [ ] Edge Function 已部署
- [ ] Edge Function 測試成功（`/auth` 端點返回正確的 JSON）

### LINE Developers Console
- [ ] Callback URL 已添加：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`

### 前端
- [ ] `handleLineLogin` 函數已添加
- [ ] `handleSocialLogin` 已更新（LINE 使用自訂處理）
- [ ] LINE 回調處理已實作
- [ ] 測試成功（Web 版和 App 版）

---

## 🔗 相關文件

- [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md)
- [LINE 第三方登入完整設定指南](./LINE第三方登入完整設定指南.md)
- [Supabase Edge Functions 文件](https://supabase.com/docs/guides/functions)

---

## 📞 需要幫助？

如果遇到問題：
1. 檢查上述檢查清單中的所有項目
2. 查看 Edge Function 日誌（Supabase Dashboard → Edge Functions → Logs）
3. 查看前端 Console 日誌
4. 確認所有環境變數已正確設定

---

**完成所有步驟後，LINE 登入功能就可以使用了！** 🎉

