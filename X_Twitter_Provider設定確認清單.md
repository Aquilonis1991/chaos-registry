# X (Twitter) Provider 設定確認清單

## ✅ 已確認事項

根據 Supabase 官方文檔：
- ✅ **Provider 名稱**：`'twitter'`（正確，即使 Twitter 已改名為 X）
- ✅ **代碼實現**：使用 `signInWithOAuth({ provider: 'twitter' })`（正確）

---

## 🔍 Supabase Dashboard 設定檢查

### 步驟 1：確認 Provider 選項

在 Supabase Dashboard → Authentication → Providers 中，您應該看到：

1. **X / Twitter (OAuth 2.0)** ✅ 應該使用這個
2. **Twitter (Deprecated)** ❌ 不要使用這個

---

### 步驟 2：檢查 Provider 狀態

對於 **X / Twitter (OAuth 2.0)** Provider：

- [ ] **開關狀態**：必須是 **啟用**（綠色/ON 狀態）
  - ⚠️ 重要：僅填入憑證**不足以啟用**，必須點擊開關
  - 如果開關是灰色/OFF，點擊開關啟用

- [ ] **Client ID (for OAuth)**：
  - 已填入（從 X Developer Portal 的 **API Key**）
  - 格式：通常是長字串，例如 `xxxxxxxxxxxxxxxxxx`
  - 確認沒有多餘的空格或換行

- [ ] **Client Secret (for OAuth)**：
  - 已填入（從 X Developer Portal 的 **API Secret Key**）
  - 格式：通常是長字串
  - 確認沒有多餘的空格或換行

- [ ] **Allow users without an email**：
  - ✅ 已啟用（勾選/ON）
  - 這是重要的，因為 X 可能不返回 email

- [ ] **Callback URL (for OAuth)**：
  - 顯示為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
  - 這是自動生成的，不需要手動修改

- [ ] **Save 按鈕**：
  - 已點擊 **Save** 儲存設定
  - 看到成功訊息或確認設定已儲存

---

### 步驟 3：驗證設定已生效

1. **重新整理頁面**：
   - 在 Supabase Dashboard 中重新整理頁面
   - 確認開關仍然是啟用狀態
   - 確認憑證仍然存在

2. **檢查其他 Provider**：
   - 確認 "Twitter (Deprecated)" 是**停用**狀態
   - 如果啟用了，請停用它

---

## 🔧 X Developer Portal 設定檢查

### 步驟 1：確認應用程式類型

在 X Developer Portal → User authentication settings：

- [ ] **Type of App**：
  - 選擇 **"Web App, Automated App or Bot"**
  - 不是 "Native App" 或其他選項

- [ ] **App permissions**：
  - 至少選擇 **"Read"** 權限
  - 可以選擇 "Read" 和 "Offline access"

---

### 步驟 2：確認 Callback URI

在 **Callback URI / Redirect URL** 中：

- [ ] 已添加：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] 確認格式完全正確（沒有多餘空格、斜線等）
- [ ] 如果有多個 Callback URI，確認這個在列表中
- [ ] 已點擊 **Save** 儲存

---

### 步驟 3：確認 API 憑證

在 **Keys and tokens** 區塊中：

- [ ] **API Key** 已生成（這就是 Client ID）
- [ ] **API Secret Key** 已生成（這就是 Client Secret）
- [ ] 已複製到 Supabase Dashboard 的對應欄位

---

## 🐛 常見問題排查

### 問題 1：開關已啟用但仍出現錯誤

**可能原因**：
- 設定沒有正確儲存
- 需要等待幾秒讓設定生效
- 瀏覽器緩存問題

**解決方案**：
1. 在 Supabase Dashboard 中：
   - 先**停用** Provider（關閉開關）
   - 點擊 **Save**
   - 等待 2-3 秒
   - 再**啟用** Provider（打開開關）
   - 點擊 **Save**
   - 等待 2-3 秒

2. 清除瀏覽器緩存並重新測試

---

### 問題 2：確認使用的是正確的 Provider

**檢查**：
- 在 Supabase Dashboard 中，確認您看到的是 **"X / Twitter (OAuth 2.0)"**
- 不是 **"Twitter (Deprecated)"**

**如果看到兩個選項**：
- ✅ 啟用 **"X / Twitter (OAuth 2.0)"**
- ❌ 停用 **"Twitter (Deprecated)"**

---

### 問題 3：憑證格式問題

**檢查**：
- Client ID 和 Client Secret 不應該有：
  - 多餘的空格（前後或中間）
  - 換行符號
  - 特殊字符（除非是憑證的一部分）

**解決方案**：
- 從 X Developer Portal 重新複製憑證
- 在 Supabase Dashboard 中重新貼上
- 確認沒有多餘的空格
- 點擊 **Save**

---

### 問題 4：Callback URI 不匹配

**檢查**：
- X Developer Portal 中的 Callback URI 必須**完全匹配**：
  ```
  https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
  ```

**常見錯誤**：
- ❌ `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback/`（結尾多斜線）
- ❌ `http://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`（使用 http 而不是 https）
- ❌ `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback `（結尾有空格）

---

## 🧪 測試步驟

### 步驟 1：清除緩存

1. 在 APP 中：
   - 完全關閉 APP
   - 清除 APP 數據（可選）
   - 重新啟動 APP

2. 在瀏覽器中（如果測試網頁版）：
   - 清除瀏覽器緩存
   - 或使用無痕模式

---

### 步驟 2：測試登入

1. 打開登入頁面
2. 點擊 X (Twitter) 登入按鈕
3. 觀察行為：
   - ✅ 應該跳轉到 X 授權頁面
   - ❌ 不應該出現 "不支援的提供者：提供者未啟用" 錯誤

---

### 步驟 3：檢查日誌

如果仍然出現錯誤，檢查：

1. **Supabase Dashboard → Logs**：
   - 查看 Authentication 日誌
   - 查看是否有相關錯誤訊息

2. **APP 日誌**：
   - 查看完整的錯誤訊息
   - 確認錯誤代碼和詳細資訊

---

## 📋 完整檢查清單

### Supabase Dashboard
- [ ] 已找到 **X / Twitter (OAuth 2.0)** Provider
- [ ] Provider 開關已**啟用**（綠色/ON）
- [ ] Client ID 已填入（從 X Developer Portal 的 API Key）
- [ ] Client Secret 已填入（從 X Developer Portal 的 API Secret Key）
- [ ] "Allow users without an email" 已啟用
- [ ] 已點擊 **Save** 儲存
- [ ] 確認 "Twitter (Deprecated)" 已停用
- [ ] 重新整理頁面後設定仍然存在

### X Developer Portal
- [ ] Type of App 設定為 "Web App, Automated App or Bot"
- [ ] App permissions 至少包含 "Read"
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] Callback URI 格式完全正確（沒有多餘空格或斜線）
- [ ] API Key 和 API Secret Key 已生成
- [ ] 設定已儲存

### 代碼
- [x] 使用 `'twitter'` 作為 provider 名稱（已確認正確）
- [x] 使用 `handleSocialLogin('twitter')`（已確認正確）

---

## 🔄 如果問題仍然存在

如果完成所有檢查後問題仍然存在，請提供：

1. **Supabase Dashboard 截圖**：
   - Authentication → Providers → X / Twitter (OAuth 2.0) 的設定頁面
   - 確認開關狀態和憑證是否填入

2. **錯誤的完整訊息**：
   - 包括所有錯誤代碼和詳細資訊

3. **Supabase Dashboard 日誌**：
   - Authentication 相關的日誌
   - 最近的錯誤記錄

---

**更新日期**：2026-01-13  
**狀態**：等待設定確認和測試結果
