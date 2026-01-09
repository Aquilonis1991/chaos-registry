# X / Twitter Edge Function 環境變數設定 - 替代方法

## 🔍 問題

在 Supabase Dashboard 的 Edge Functions 詳情頁面中找不到 Settings 選項。

---

## ✅ 解決方案：使用專案級別的 Settings

### 方法 1：在專案 Settings 中設定（推薦）

1. **前往 Supabase Dashboard**
   - 網址：https://app.supabase.com/
   - 選擇專案：`epyykzxxglkjombvozhr`

2. **導航到 Settings > Edge Functions**
   - 在左側選單中點擊 **Settings**（齒輪圖標）
   - 點擊 **Edge Functions** 標籤

3. **添加環境變數**
   - 在 **Environment Variables** 區域
   - 點擊 **Add new variable** 或 **+** 按鈕
   - 依次添加以下三個環境變數：

   **變數 1：TWITTER_CLIENT_ID**
   - **Key**：`TWITTER_CLIENT_ID`
   - **Value**：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - 點擊 **Save**

   **變數 2：TWITTER_CLIENT_SECRET**
   - **Key**：`TWITTER_CLIENT_SECRET`
   - **Value**：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
   - 點擊 **Save**

   **變數 3：JWT_SECRET**
   - **Key**：`JWT_SECRET`
   - **Value**：貼上從 Settings > API 獲取的 JWT Secret
   - 點擊 **Save**

4. **確認所有變數已添加**
   - 確認三個環境變數都已顯示在列表中
   - 確認值都正確無誤

---

### 方法 2：使用 Supabase CLI（最可靠）

如果 Dashboard 中找不到設定選項，可以使用 Supabase CLI：

#### 步驟 1：安裝 Supabase CLI（如果尚未安裝）

```bash
# Windows (使用 PowerShell)
npm install -g supabase

# 或使用 Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### 步驟 2：登入 Supabase

```bash
supabase login
```

#### 步驟 3：連結到專案

```bash
supabase link --project-ref epyykzxxglkjombvozhr
```

#### 步驟 4：設定環境變數

```bash
# 設定 TWITTER_CLIENT_ID
supabase secrets set TWITTER_CLIENT_ID=R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ --project-ref epyykzxxglkjombvozhr

# 設定 TWITTER_CLIENT_SECRET
supabase secrets set TWITTER_CLIENT_SECRET=rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG --project-ref epyykzxxglkjombvozhr

# 設定 JWT_SECRET（需要先獲取 JWT Secret）
# 從 Supabase Dashboard > Settings > API > JWT Secret 獲取
supabase secrets set JWT_SECRET=你的JWT_SECRET值 --project-ref epyykzxxglkjombvozhr
```

#### 步驟 5：重新部署 Edge Function

```bash
# 確保在專案目錄中
cd C:\Users\USER\Documents\Mywork\votechaos-main

# 部署 twitter-auth Edge Function
supabase functions deploy twitter-auth
```

---

### 方法 3：在函數代碼中直接設定（不推薦，僅用於測試）

如果以上方法都不行，可以暫時在 Edge Function 代碼中直接設定（**僅用於測試，生產環境不推薦**）：

```typescript
// 在 supabase/functions/twitter-auth/index.ts 中
const TWITTER_CLIENT_ID = Deno.env.get('TWITTER_CLIENT_ID') || 'R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ'
const TWITTER_CLIENT_SECRET = Deno.env.get('TWITTER_CLIENT_SECRET') || 'rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG'
```

**⚠️ 警告**：這種方法會將敏感資訊暴露在代碼中，不建議用於生產環境。

---

## 🔍 獲取 JWT Secret 的步驟

1. **前往 Supabase Dashboard**
   - 網址：https://app.supabase.com/
   - 選擇專案：`epyykzxxglkjombvozhr`

2. **導航到 Settings > API**
   - 在左側選單中點擊 **Settings**（齒輪圖標）
   - 點擊 **API** 標籤

3. **找到 JWT Secret**
   - 在 **Project API keys** 區域下方
   - 找到 **JWT Secret** 欄位
   - 點擊 **Reveal** 或 **Show** 按鈕顯示完整 Secret
   - **複製完整的 JWT Secret**

---

## 📋 完整檢查清單

- [ ] 已從 Supabase Dashboard > Settings > API 獲取 JWT Secret
- [ ] 已嘗試在 Settings > Edge Functions 中設定環境變數
- [ ] 如果 Dashboard 方法不可用，已安裝 Supabase CLI
- [ ] 已使用 Supabase CLI 登入並連結專案
- [ ] 已使用 Supabase CLI 設定 `TWITTER_CLIENT_ID`
- [ ] 已使用 Supabase CLI 設定 `TWITTER_CLIENT_SECRET`
- [ ] 已使用 Supabase CLI 設定 `JWT_SECRET`
- [ ] 已重新部署 `twitter-auth` Edge Function
- [ ] 已測試 X (Twitter) 登入功能

---

## 🐛 故障排除

### 問題 1：找不到 Settings > Edge Functions

**解決方案**：
- 確認您有專案的管理員權限
- 嘗試使用 Supabase CLI 方法
- 檢查 Supabase Dashboard 的版本（可能需要更新）

### 問題 2：Supabase CLI 無法連結專案

**解決方案**：
- 確認已正確登入：`supabase login`
- 確認專案引用（project-ref）正確：`epyykzxxglkjombvozhr`
- 檢查是否有網路連接問題

### 問題 3：環境變數設定後仍無法使用

**解決方案**：
- 確認已重新部署 Edge Function
- 檢查環境變數名稱是否正確（大小寫敏感）
- 確認值沒有多餘的空格或換行
- 檢查 Edge Function 日誌以查看錯誤訊息

---

## 📝 驗證環境變數是否設定成功

### 使用 Supabase CLI 檢查

```bash
# 列出所有環境變數（注意：值會被隱藏）
supabase secrets list --project-ref epyykzxxglkjombvozhr
```

### 檢查 Edge Function 日誌

1. 前往 Supabase Dashboard > Edge Functions > twitter-auth
2. 點擊 **Logs** 標籤
3. 嘗試使用 X (Twitter) 登入
4. 檢查日誌中是否有環境變數相關的錯誤

---

**建議優先使用方法 2（Supabase CLI），這是最可靠的方法！**
