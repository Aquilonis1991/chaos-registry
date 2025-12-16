# X (Twitter) 登入 - Edge Function 實作步驟

> **建立日期**：2025-01-29  
> **方法**：使用自訂 Edge Function 繞過 Supabase 的 Twitter Provider 問題

---

## 📋 概述

由於 Supabase 的 Twitter Provider 存在問題，我們將使用自訂 Edge Function 來實作 X (Twitter) 登入，類似於 LINE 登入的實現方式。

---

## 🔧 實作步驟

### 步驟 1：執行資料庫 Migration

**添加 `twitter_user_id` 欄位到 `profiles` 表**：

1. **登入 Supabase Dashboard**
2. **進入 SQL Editor**
3. **執行以下 SQL**：

```sql
-- 添加 twitter_user_id 欄位到 profiles 表
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS twitter_user_id TEXT UNIQUE;

-- 添加索引以加快查詢
CREATE INDEX IF NOT EXISTS profiles_twitter_user_id_idx ON public.profiles (twitter_user_id);
```

或使用 Supabase CLI：

```bash
cd votechaos-main
npx supabase db push
```

---

### 步驟 2：設置環境變數

**在 Supabase Dashboard 中設置 Edge Function 環境變數**：

1. **進入 Settings → Edge Functions → Secrets**
2. **添加以下環境變數**：

   - **TWITTER_CLIENT_ID**：
     ```
     R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ
     ```

   - **TWITTER_CLIENT_SECRET**：
     ```
     rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG
     ```

   - **FRONTEND_URL**（可選，已有預設值）：
     ```
     https://chaos-registry.vercel.app
     ```

   - **FRONTEND_DEEP_LINK**（可選，已有預設值）：
     ```
     votechaos://auth/callback
     ```

   - **SERVICE_ROLE_KEY**（如果還沒有）：
     - 從 **Settings → API** 中複製 **service_role** key
     - ⚠️ **這是私密資訊，請妥善保管**

---

### 步驟 3：部署 Edge Function

**使用 Supabase CLI 部署 Edge Function**：

```bash
cd votechaos-main
npx supabase functions deploy twitter-auth
```

**或使用 Supabase Dashboard**：

1. **進入 Edge Functions**
2. **點擊「Deploy」或「Upload」**
3. **選擇 `supabase/functions/twitter-auth` 目錄**

---

### 步驟 4：更新 X Developer Portal Callback URI

**重要**：需要更新 X Developer Portal 的 Callback URI 為 Edge Function 的 URL。

1. **登入 [X Developer Portal](https://developer.x.com/)**
2. **進入您的專案和應用程式**
3. **進入 User authentication settings**
4. **更新 Callback URI / Redirect URL**：
   - **舊值**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - **新值**：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
5. **點擊「Save」**
6. **等待 30-60 秒讓設定生效**

---

### 步驟 5：重新建置和同步前端

**重新建置前端並同步到 Android**：

```bash
cd votechaos-main
npm run build
npx cap sync android
```

---

### 步驟 6：測試

**在 Android Studio 中測試**：

1. **運行應用程式**
2. **點擊 Twitter 登入按鈕**
3. **觀察行為**：
   - ✅ **成功**：顯示 X 授權頁面
   - ❌ **失敗**：顯示錯誤訊息

---

## 📝 已完成的修改

### 1. Edge Function

- ✅ 創建了 `supabase/functions/twitter-auth/index.ts`
- ✅ 實作了 OAuth 2.0 with PKCE 流程
- ✅ 實作了用戶創建和 session 生成

### 2. 資料庫 Migration

- ✅ 創建了 `supabase/migrations/20250129000001_add_twitter_user_id_to_profiles.sql`
- ✅ 添加 `twitter_user_id` 欄位到 `profiles` 表

### 3. 前端代碼

- ✅ 添加了 `handleTwitterLogin` 函數
- ✅ 更新了 `handleSocialLogin` 以使用 Edge Function
- ✅ 更新了 `useEffect` 以處理 Twitter 回調

---

## 🎯 下一步

### 立即執行

1. **✅ 執行資料庫 Migration**
2. **✅ 設置環境變數**
3. **✅ 部署 Edge Function**
4. **✅ 更新 X Developer Portal Callback URI**
5. **✅ 重新建置和同步前端**
6. **✅ 測試**

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [LINE 登入-EdgeFunction實作步驟](./LINE登入-EdgeFunction實作步驟.md)
- [X 登入-問題總結與最終建議](./X登入-問題總結與最終建議.md)

---

**最後更新**：2025-01-29



