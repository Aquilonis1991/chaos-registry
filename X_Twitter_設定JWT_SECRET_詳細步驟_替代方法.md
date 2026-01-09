# X (Twitter) 設定 JWT_SECRET - 詳細步驟與替代方法

## ❌ 問題

在 Supabase Dashboard 中找不到設定 Edge Function 環境變數的選項。

---

## ✅ 解決方案：使用 Supabase CLI（推薦）

Supabase Dashboard 的 UI 可能因版本而異，使用 CLI 更可靠。

### 步驟 1：確認 Supabase CLI 已安裝

```bash
npx supabase --version
```

如果沒有安裝，會自動下載。

---

### 步驟 2：登入 Supabase

```bash
cd votechaos-main
npx supabase login
```

這會打開瀏覽器，讓您登入 Supabase 帳號。

---

### 步驟 3：連結專案

```bash
npx supabase link --project-ref epyykzxxglkjombvozhr
```

如果已經連結過，可以跳過這一步。

---

### 步驟 4：設定 JWT_SECRET 環境變數

```bash
npx supabase secrets set JWT_SECRET=W5GXYqKqbMV4JFCz0ma0cU85//cKkeOlB7ELigyETEb677bLYQjlxTJcPoEuTwQ0Rq7xddIqarlugtX9fzgdSw==
```

**重要**：確保值完全正確，沒有多餘的空格或換行。

---

### 步驟 5：驗證環境變數已設定

```bash
npx supabase secrets list
```

應該會看到 `JWT_SECRET` 在列表中。

---

### 步驟 6：重新部署 Edge Function

```bash
npx supabase functions deploy twitter-auth
```

---

## 🔍 方法 2：在 Supabase Dashboard 中查找（不同版本可能有不同位置）

### 位置 1：Edge Functions 頁面

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`epyykzxxglkjombvozhr`
3. 在左側選單中，點擊 **Edge Functions**
4. 找到 **twitter-auth** 函數
5. 點擊 **twitter-auth** 進入函數詳情頁
6. 查看是否有以下選項：
   - **Settings** 標籤
   - **Configuration** 標籤
   - **Environment Variables** 區塊
   - **Secrets** 區塊

---

### 位置 2：Project Settings

1. 在 Supabase Dashboard 中，點擊左側選單的 **Settings**（齒輪圖標）
2. 選擇 **Edge Functions**
3. 查看是否有 **Environment Variables** 或 **Secrets** 選項

---

### 位置 3：直接在函數代碼中查看

1. 在 Edge Functions 頁面中，點擊 **twitter-auth**
2. 查看是否有 **Settings** 或 **Configuration** 按鈕
3. 有些版本會在函數列表的右側有 **...** 選單，點擊查看是否有 **Settings** 選項

---

## 🔧 方法 3：直接在 Edge Function 代碼中硬編碼（不推薦，僅用於測試）

如果以上方法都無法使用，可以暫時在 Edge Function 代碼中硬編碼 JWT Secret（僅用於測試，生產環境不推薦）：

**修改 `supabase/functions/twitter-auth/index.ts`**：

```typescript
// State 簽名密鑰（用於 CSRF 保護）
// 使用 Supabase 的 JWT Secret，這樣 Supabase 的內建處理邏輯就能驗證簽名
// 如果沒有設定 JWT_SECRET 環境變數，回退到使用 SERVICE_ROLE_KEY
const JWT_SECRET = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET') || 'W5GXYqKqbMV4JFCz0ma0cU85//cKkeOlB7ELigyETEb677bLYQjlxTJcPoEuTwQ0Rq7xddIqarlugtX9fzgdSw=='
const STATE_SECRET = JWT_SECRET || SERVICE_ROLE_KEY.substring(0, 32) // 優先使用 JWT_SECRET，否則使用前 32 個字符
```

**⚠️ 警告**：這會將 JWT Secret 暴露在代碼中，不適合生產環境。僅用於測試。

---

## 📋 完整 CLI 操作流程

```bash
# 1. 進入專案目錄
cd votechaos-main

# 2. 確認 Supabase CLI 已安裝
npx supabase --version

# 3. 登入 Supabase（如果需要）
npx supabase login

# 4. 連結專案（如果還沒有連結）
npx supabase link --project-ref epyykzxxglkjombvozhr

# 5. 設定 JWT_SECRET 環境變數
npx supabase secrets set JWT_SECRET=W5GXYqKqbMV4JFCz0ma0cU85//cKkeOlB7ELigyETEb677bLYQjlxTJcPoEuTwQ0Rq7xddIqarlugtX9fzgdSw==

# 6. 驗證環境變數已設定
npx supabase secrets list

# 7. 重新部署 Edge Function
npx supabase functions deploy twitter-auth
```

---

## ✅ 驗證設定

### 檢查環境變數

```bash
npx supabase secrets list
```

應該會看到：
```
JWT_SECRET
```

---

### 測試 X (Twitter) 登入

1. 清除瀏覽器快取和 Cookie
2. 嘗試使用 X (Twitter) 登入
3. 檢查 Supabase Auth Logs：
   - 在 Supabase Dashboard 中，導航到 **Logs** > **Auth Logs**
   - 確認沒有 `token signature is invalid` 錯誤
   - 確認登入流程正常完成

---

## 🐛 常見問題

### 問題 1：`npx supabase login` 失敗

**解決方案**：
- 確保已安裝 Node.js
- 嘗試使用 `npm install -g supabase` 全局安裝
- 或直接使用 `npx supabase` 命令（會自動下載）

---

### 問題 2：`npx supabase link` 失敗

**解決方案**：
- 確認專案引用 ID 正確：`epyykzxxglkjombvozhr`
- 確認已登入 Supabase
- 確認有權限訪問該專案

---

### 問題 3：`npx supabase secrets set` 失敗

**解決方案**：
- 確認已連結專案
- 確認值完全正確（沒有多餘的空格或換行）
- 嘗試用引號包裹值：
  ```bash
  npx supabase secrets set JWT_SECRET="W5GXYqKqbMV4JFCz0ma0cU85//cKkeOlB7ELigyETEb677bLYQjlxTJcPoEuTwQ0Rq7xddIqarlugtX9fzgdSw=="
  ```

---

### 問題 4：環境變數已設定但 Edge Function 仍無法使用

**解決方案**：
1. 確認已重新部署 Edge Function
2. 檢查 Edge Function 日誌，確認環境變數是否被正確讀取
3. 確認 Edge Function 代碼正確使用 `Deno.env.get('JWT_SECRET')`

---

## 📚 相關文件

- `X_Twitter_設定JWT_SECRET_立即修復步驟.md` - 基本設定步驟
- `X_Twitter_停用內建Provider後仍被攔截_解決方案.md` - 完整問題分析
- `supabase/functions/twitter-auth/index.ts` - Edge Function 實作

---

**推薦方法**：使用 Supabase CLI 設定環境變數，這是最可靠的方法。
