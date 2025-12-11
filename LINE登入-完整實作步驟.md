# LINE 登入 - 完整實作步驟

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

## 🚀 步驟 1：執行資料庫 Migration

### 方法 1：在 Supabase Dashboard 中執行（推薦）

1. **登入 Supabase Dashboard**
   - 前往：https://app.supabase.com/
   - 選擇專案：`votechaos` (epyykzxxglkjombvozhr)

2. **進入 SQL Editor**
   - 在左側導航欄，點擊 **「SQL Editor」**
   - 或直接訪問：https://app.supabase.com/project/epyykzxxglkjombvozhr/sql/new

3. **執行以下 SQL**：

```sql
-- Add line_user_id column to profiles table for LINE login integration
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS line_user_id TEXT;

-- Create unique index on line_user_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_line_user_id 
ON public.profiles(line_user_id) 
WHERE line_user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.line_user_id IS 'LINE user ID for LINE login integration';
```

4. **驗證執行結果**：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'line_user_id';
```

**預期結果**：應該返回一行，顯示 `line_user_id` 欄位。

---

## 🔧 步驟 2：設定環境變數

### 2.1 進入 Supabase Dashboard

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
3. 進入 **Project Settings** → **Edge Functions** → **Secrets**

### 2.2 取得 Service Role Key

1. 在 Supabase Dashboard 中，進入 **Project Settings** → **API**
2. 找到 **Service Role Key**（⚠️ 這是敏感資訊，請妥善保管）
3. 複製 Service Role Key

### 2.3 添加環境變數

在 **Secrets** 區塊中，點擊 **「Add new secret」**，依序添加以下環境變數：

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `SERVICE_ROLE_KEY` | （從 Project Settings → API 複製） | ⚠️ **重要**：不能使用 `SUPABASE_SERVICE_ROLE_KEY` |
| `LINE_CHANNEL_ID` | `2008600116` | LINE Channel ID |
| `LINE_CHANNEL_SECRET` | `079ebaa784b4c00184e68bafb1841d77` | LINE Channel Secret |
| `LINE_REDIRECT_URI` | `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback` | LINE 回調 URL |
| `FRONTEND_URL` | `https://chaos-registry.vercel.app` | 前端網站 URL（用於錯誤處理，建議添加） |
| `FRONTEND_DEEP_LINK` | `votechaos://auth/callback` | App Deep Link（**App 登入必需**） |

**注意**：
- `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 會自動設定，不需要手動添加
- ⚠️ **環境變數名稱不能以 `SUPABASE_` 開頭**，所以使用 `SERVICE_ROLE_KEY` 而不是 `SUPABASE_SERVICE_ROLE_KEY`
- **如果您主要是 App 登入**：
  - ✅ `FRONTEND_DEEP_LINK` 是**必需的**（App 登入成功後會重定向到這個 Deep Link）
  - ⭐ `FRONTEND_URL` 建議添加（用於錯誤處理的 fallback，即使主要是 App 登入也需要）
- **如果您主要是 Web 登入**：
  - ✅ `FRONTEND_URL` 是**必需的**
  - ⭐ `FRONTEND_DEEP_LINK` 建議添加（用於未來支援 App 登入）

---

## 🚀 步驟 3：部署 Edge Function

### 3.1 確認 Supabase CLI 已安裝

在終端機中執行：

```bash
cd C:\Users\USER\Documents\Mywork\votechaos-main
npx supabase --version
```

如果沒有安裝，會自動下載。

### 3.2 登入 Supabase（如果需要）

```bash
npx supabase login
```

這會打開瀏覽器，要求您登入 Supabase 帳號。

### 3.3 連結專案（如果需要）

```bash
npx supabase link --project-ref epyykzxxglkjombvozhr
```

**注意**：如果已經連結過，會顯示 "Project already linked"。

### 3.4 部署 Edge Function

```bash
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

### 3.5 驗證部署

**測試授權端點**：

在瀏覽器中訪問：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth
```

**預期行為**：
- 應該會重定向到 LINE 授權頁面
- 或返回 JSON 格式的錯誤訊息（如果環境變數未設定）

**如果出現錯誤**：
- 檢查環境變數是否已設定（Supabase Dashboard → Edge Functions → Secrets）
- 檢查 Edge Function 日誌（Supabase Dashboard → Edge Functions → line-auth → Logs）

---

## 🔧 步驟 4：更新 LINE Developers Console

### 4.1 登入 LINE Developers Console

1. 前往：https://developers.line.biz/console/
2. 選擇 Provider：`ChaosRegistry`
3. 選擇 Channel：`2008600116`

### 4.2 添加 Callback URL

1. 進入 **LINE Login** 設定頁面
2. 找到 **Callback URL** 區塊
3. 確認是否已包含以下 URL：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
   ```
4. 如果沒有，點擊 **「Add」** 添加上述 URL
5. 點擊 **「Update」** 儲存設定

---

## ✅ 步驟 5：測試功能

### 5.1 Web 版測試

1. **打開瀏覽器**，訪問：`https://chaos-registry.vercel.app/auth`
2. **點擊「使用 LINE 登入」按鈕**
3. **應該會跳轉到 LINE 授權頁面**
4. **使用 LINE 帳號登入並授權應用**
5. **應該會重定向回應用並完成登入**

### 5.2 App 版測試（Android/iOS）

1. **在 Android Studio 或 Xcode 中運行 App**
2. **在登入頁面點擊「使用 LINE 登入」按鈕**
3. **應該會打開瀏覽器，顯示 LINE 授權頁面**
4. **授權後會透過 Deep Link `votechaos://auth/callback` 返回 App**
5. **App 應該會自動完成登入**

### 5.3 檢查日誌

**Edge Function 日誌**：
1. 在 Supabase Dashboard 中，進入 **Edge Functions** → **line-auth** → **Logs**
2. 查看是否有錯誤訊息

**前端日誌**：
1. 打開瀏覽器開發者工具（F12）
2. 查看 Console 中的日誌

---

## ⚠️ 常見問題與解決方案

### 問題 1：環境變數設定錯誤

**錯誤訊息**：`Name must not start with the SUPABASE_ prefix`

**解決方案**：
- 使用 `SERVICE_ROLE_KEY` 而不是 `SUPABASE_SERVICE_ROLE_KEY`

### 問題 2：Edge Function 部署失敗

**錯誤訊息**：`Function deployment failed`

**解決方案**：
1. 確認已登入 Supabase CLI：`npx supabase login`
2. 確認專案已連結：`npx supabase link --project-ref epyykzxxglkjombvozhr`
3. 檢查 Edge Function 程式碼是否有語法錯誤
4. 確認環境變數已設定

### 問題 3：LINE 回調失敗

**錯誤訊息**：`redirect_uri_mismatch`

**解決方案**：
1. 確認 LINE Developers Console 中的 Callback URL 為：
   `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
2. 確認 Edge Function 中的 `LINE_REDIRECT_URI` 環境變數與上述 URL 一致

### 問題 4：無法建立用戶

**錯誤訊息**：`Failed to create user`

**解決方案**：
1. 確認 `SERVICE_ROLE_KEY` 環境變數已設定（⚠️ 不是 `SUPABASE_SERVICE_ROLE_KEY`）
2. 確認 Service Role Key 正確無誤
3. 檢查 Edge Function 日誌中的詳細錯誤訊息

### 問題 5：Session 設定失敗

**解決方案**：
1. 確認 Edge Function 返回的 token 格式正確
2. 檢查前端程式碼中的 session 設定邏輯
3. 查看瀏覽器 Console 中的錯誤訊息

---

## 📝 檢查清單

### 資料庫
- [ ] Migration 已執行：`20250129000000_add_line_user_id_to_profiles.sql`
- [ ] `profiles` 表已添加 `line_user_id` 欄位
- [ ] 索引已建立

### Edge Function
- [ ] 環境變數已設定：
  - [ ] `SERVICE_ROLE_KEY`（⚠️ 不是 `SUPABASE_SERVICE_ROLE_KEY`）
  - [ ] `LINE_CHANNEL_ID`
  - [ ] `LINE_CHANNEL_SECRET`
  - [ ] `LINE_REDIRECT_URI`
  - [ ] `FRONTEND_URL`（建議添加，用於錯誤處理）
  - [ ] `FRONTEND_DEEP_LINK`（**App 登入必需**）
- [ ] Edge Function 已部署
- [ ] Edge Function 測試成功（訪問 `/line-auth` 端點會重定向到 LINE）

### LINE Developers Console
- [ ] Callback URL 已添加：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`

### 測試
- [ ] Web 版測試成功
- [ ] App 版測試成功（如果適用）

---

## 🔗 相關文件

- [LINE 登入 - Edge Function 實作詳細步驟](./LINE登入-EdgeFunction實作步驟.md)
- [LINE 登入 - 實作檢查清單](./LINE登入-實作檢查清單.md)
- [LINE 登入 - 環境變數設定提醒](./LINE登入-環境變數設定提醒.md)
- [LINE 登入 - 執行 Migration 說明](./LINE登入-執行Migration說明.md)

---

## 📞 需要幫助？

如果遇到問題：
1. 檢查上述檢查清單中的所有項目
2. 查看 Edge Function 日誌（Supabase Dashboard → Edge Functions → Logs）
3. 查看前端 Console 日誌
4. 確認所有環境變數已正確設定

---

**完成所有步驟後，LINE 登入功能就可以使用了！** 🎉

