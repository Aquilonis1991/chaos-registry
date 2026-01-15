# X (Twitter) Provider 強制重新啟用流程

## ❌ 當前錯誤

根據 Supabase 日誌：
```json
{
  "code": 400,
  "error_code": "validation_failed",
  "msg": "Unsupported provider: provider is not enabled",
  "error": "provider is not enabled",
  "path": "/authorize"
}
```

**這明確表示**：X / Twitter Provider 在 Supabase 中**沒有被啟用**。

---

## 🔄 強制重新啟用流程（請嚴格按照步驟執行）

### 步驟 1：完全停用並清除設定

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
3. 進入 **Authentication** → **Providers**
4. 找到 **X / Twitter (OAuth 2.0)**
5. **重要操作**：
   - 如果開關是 **ON（綠色）**，點擊開關**關閉**（變成灰色/OFF）
   - **清除** Client ID 欄位（刪除所有內容）
   - **清除** Client Secret 欄位（刪除所有內容）
   - 取消勾選 "Allow users without an email"（如果已勾選）
   - 點擊 **Save** 按鈕
   - **等待 10 秒**（讓設定完全清除）

---

### 步驟 2：確認已完全清除

1. **重新整理瀏覽器頁面**（按 F5 或 Ctrl+R）
2. 確認：
   - 開關是 **OFF（灰色）**
   - Client ID 欄位是**空的**
   - Client Secret 欄位是**空的**
   - "Allow users without an email" 是**未勾選**

如果還有任何內容，重複步驟 1。

---

### 步驟 3：從 X Developer Portal 重新獲取憑證

1. 前往 [X Developer Portal](https://developer.x.com/)
2. 登入您的帳號
3. 進入您的專案和應用程式
4. 進入 **「User authentication settings」**
5. 確認 **Callback URI** 設定為：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
6. 在 **「Keys and tokens」** 區塊中：
   - 複製 **API Key**（這就是 Client ID）
   - 複製 **API Secret Key**（這就是 Client Secret）
   - **重要**：確認沒有多餘的空格或換行

---

### 步驟 4：重新填入並啟用

1. 回到 Supabase Dashboard → Authentication → Providers → X / Twitter (OAuth 2.0)
2. **按順序執行**（不要跳過任何步驟）：
   - **步驟 4.1**：填入 **Client ID (for OAuth)**
     - 從 X Developer Portal 複製 API Key
     - 貼到 Supabase 的 Client ID 欄位
     - **確認沒有多餘空格**
   
   - **步驟 4.2**：填入 **Client Secret (for OAuth)**
     - 從 X Developer Portal 複製 API Secret Key
     - 貼到 Supabase 的 Client Secret 欄位
     - **確認沒有多餘空格**
   
   - **步驟 4.3**：勾選 **"Allow users without an email"**
     - ✅ 勾選此選項
   
   - **步驟 4.4**：**點擊開關啟用**（從 OFF 變成 ON，從灰色變成綠色）
     - ⚠️ **這是最關鍵的步驟**：開關必須是 **ON（綠色）**
   
   - **步驟 4.5**：點擊 **Save** 按鈕
     - 等待看到成功訊息或確認已儲存
   
   - **步驟 4.6**：**等待 10-15 秒**（讓設定生效）

---

### 步驟 5：驗證設定已生效

1. **重新整理瀏覽器頁面**（按 F5 或 Ctrl+R）
2. 確認：
   - ✅ 開關是 **ON（綠色/啟用）**
   - ✅ Client ID 欄位**有內容**（不是空的）
   - ✅ Client Secret 欄位**有內容**（不是空的，顯示為 `••••••••`）
   - ✅ "Allow users without an email" 是**已勾選**
   - ✅ Callback URL 顯示為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

**如果任何一項不符合，重複步驟 4。**

---

### 步驟 6：確認沒有啟用錯誤的 Provider

1. 在 Supabase Dashboard → Authentication → Providers 中
2. 檢查是否有 **"Twitter (Deprecated)"** Provider
3. 如果存在：
   - ✅ 確認它是 **OFF（灰色/停用）**
   - ❌ 如果它是 ON，請**關閉它**

---

### 步驟 7：測試登入

1. **完全關閉 APP**（如果正在運行）
2. **重新啟動 APP**
3. 點擊 X (Twitter) 登入按鈕
4. **預期結果**：
   - ✅ 應該跳轉到 X 授權頁面
   - ❌ 不應該出現 "provider is not enabled" 錯誤

---

## 🔍 如果問題仍然存在

### 檢查 1：確認使用的是正確的 Provider

在 Supabase Dashboard 中，確認您看到的是：
- ✅ **X / Twitter (OAuth 2.0)**（應該使用這個）
- ❌ **Twitter (Deprecated)**（不要使用這個）

---

### 檢查 2：檢查 Supabase 專案狀態

1. 在 Supabase Dashboard 中：
   - 檢查專案是否有任何警告或錯誤
   - 檢查專案是否處於正常狀態
   - 確認專案沒有被暫停或限制

---

### 檢查 3：測試其他 Provider

為了確認問題是否特定於 Twitter Provider：

1. **測試 Google 登入**：
   - 如果 Google 登入正常，說明 Supabase 配置正常
   - 如果 Google 也失敗，可能是 Supabase 專案問題

2. **測試 Discord 登入**：
   - 如果 Discord 登入正常，進一步確認 Supabase 配置正常

---

### 檢查 4：檢查 Supabase 日誌

1. 在 Supabase Dashboard → Logs → Authentication
2. 查看最近的日誌
3. 確認是否有其他錯誤訊息

---

## 📋 完整檢查清單

### Supabase Dashboard
- [ ] 已找到 **X / Twitter (OAuth 2.0)** Provider（不是 "Twitter (Deprecated)"）
- [ ] 已執行**完全清除流程**（開關 OFF，憑證清空）
- [ ] 已重新填入 Client ID（從 X Developer Portal 的 API Key）
- [ ] 已重新填入 Client Secret（從 X Developer Portal 的 API Secret Key）
- [ ] 已勾選 "Allow users without an email"
- [ ] **開關已啟用**（ON/綠色狀態）⚠️ **最關鍵**
- [ ] 已點擊 **Save** 儲存
- [ ] 已等待 10-15 秒讓設定生效
- [ ] 已重新整理頁面
- [ ] 確認開關仍然是啟用狀態
- [ ] 確認 "Twitter (Deprecated)" 已停用

### X Developer Portal
- [ ] Type of App 設定為 "Web App, Automated App or Bot"
- [ ] App permissions 至少包含 "Read"
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] Callback URI 格式完全正確（沒有多餘空格或斜線）
- [ ] API Key 和 API Secret Key 已重新生成（如果需要）
- [ ] 設定已儲存

### 代碼
- [x] 使用 `'twitter'` 作為 provider 名稱（已確認正確）
- [x] 使用 `handleSocialLogin('twitter')`（已確認正確）

---

## 🆘 如果完成所有步驟後問題仍然存在

請提供以下資訊：

1. **Supabase Dashboard 截圖**：
   - Authentication → Providers → X / Twitter (OAuth 2.0) 的完整設定頁面
   - 顯示開關狀態、憑證欄位（可以遮蓋實際值）
   - 確認開關是 ON 還是 OFF

2. **Supabase Dashboard 日誌**：
   - Authentication → Logs
   - 最近的錯誤記錄（特別是 `/authorize` 路徑的請求）

3. **測試結果**：
   - Google 或 Discord 登入是否正常
   - 這可以幫助判斷問題是否特定於 Twitter Provider

---

**更新日期**：2026-01-13  
**狀態**：等待強制重新啟用流程執行結果
