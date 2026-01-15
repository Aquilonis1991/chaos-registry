# X (Twitter) Provider 未啟用錯誤 - 解決方案

## ❌ 錯誤訊息

```json
{
  "code": 400,
  "error_code": "validation_failed",
  "msg": "不支援的提供者：提供者未啟用"
}
```

## 🔍 問題原因

這個錯誤表示 Supabase Dashboard 中的 **X / Twitter (OAuth 2.0) Provider** 沒有正確啟用或配置。

---

## ✅ 解決步驟

### 步驟 1：檢查 Supabase Dashboard 中的 Provider 狀態

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
3. 進入 **Authentication** → **Providers**
4. 找到 **X / Twitter (OAuth 2.0)**（不是 "Twitter (Deprecated)"）

---

### 步驟 2：啟用 X / Twitter (OAuth 2.0) Provider

1. 找到 **X / Twitter (OAuth 2.0)** Provider
2. **點擊開關啟用**（確保開關是打開的，顯示為綠色/啟用狀態）
3. 如果看到 "Twitter (Deprecated)"，**不要啟用它**，應該使用 "X / Twitter (OAuth 2.0)"

---

### 步驟 3：填入 OAuth 憑證

在 **X / Twitter (OAuth 2.0)** Provider 設定中：

1. **Client ID**：
   - 從 X Developer Portal 複製 **API Key**（也稱為 Client ID）
   - 貼到 Supabase 的 "Client ID (for OAuth)" 欄位

2. **Client Secret**：
   - 從 X Developer Portal 複製 **API Secret Key**（也稱為 Client Secret）
   - 貼到 Supabase 的 "Client Secret (for OAuth)" 欄位

3. **Allow users without an email**：
   - ✅ **啟用此選項**（因為 X 可能不返回 email）

4. **Callback URL (for OAuth)**：
   - 應該自動顯示為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - 不需要手動修改

---

### 步驟 4：儲存設定

1. 點擊 **Save** 按鈕
2. 等待設定儲存完成
3. 確認開關仍然是**啟用狀態**

---

## 🔧 從 X Developer Portal 獲取憑證

### 步驟 1：登入 X Developer Portal

1. 前往 [X Developer Portal](https://developer.x.com/)
2. 登入您的帳號

---

### 步驟 2：選擇或創建應用程式

1. 進入您的專案
2. 選擇或創建應用程式
3. 進入 **「User authentication settings」**

---

### 步驟 3：獲取 API Key 和 API Secret Key

1. 在 **「Keys and tokens」** 區塊中：
   - **API Key**：這就是 Client ID
   - **API Secret Key**：這就是 Client Secret
   - 如果沒有顯示，點擊 **「Generate」** 或 **「Regenerate」**

---

### 步驟 4：確認 Callback URI

1. 在 **「User authentication settings」** 中
2. 確認 **Callback URI / Redirect URL** 設定為：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
3. 如果不同，請更新並儲存

---

## ✅ 檢查清單

### Supabase Dashboard 設定
- [ ] 已找到 **X / Twitter (OAuth 2.0)** Provider（不是 "Twitter (Deprecated)"）
- [ ] Provider 開關已**啟用**（顯示為綠色/啟用狀態）
- [ ] Client ID 已填入（從 X Developer Portal 的 API Key）
- [ ] Client Secret 已填入（從 X Developer Portal 的 API Secret Key）
- [ ] "Allow users without an email" 已啟用
- [ ] 設定已儲存

### X Developer Portal 設定
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] API Key 和 API Secret Key 已生成

### 代碼確認
- [x] 代碼使用 `'twitter'` 作為 provider 名稱（正確）
- [x] 使用 `handleSocialLogin('twitter')`（正確）

---

## 🧪 測試步驟

1. 重新啟動 APP（如果正在運行）
2. 點擊 X (Twitter) 登入按鈕
3. 應該跳轉到 X 授權頁面
4. 授權後應該返回並完成登入

**預期結果**：
- ✅ 不再出現 "不支援的提供者：提供者未啟用" 錯誤
- ✅ 成功跳轉到 X 授權頁面
- ✅ 授權後可以正常登入

---

## ⚠️ 常見問題

### 問題 1：找不到 "X / Twitter (OAuth 2.0)" Provider

**可能原因**：
- Supabase 專案版本較舊
- 需要更新 Supabase 專案

**解決方案**：
- 檢查 Supabase Dashboard 是否有更新可用
- 或聯繫 Supabase 支援

---

### 問題 2：啟用了 "Twitter (Deprecated)" 而不是 "X / Twitter (OAuth 2.0)"

**解決方案**：
- 停用 "Twitter (Deprecated)"
- 啟用 "X / Twitter (OAuth 2.0)"
- 使用 OAuth 2.0 的 API Key 和 API Secret Key

---

### 問題 3：Client ID 或 Client Secret 錯誤

**檢查**：
- 確認從 X Developer Portal 複製的是正確的值
- API Key = Client ID
- API Secret Key = Client Secret
- 確認沒有多餘的空格或換行

---

## 📚 相關文件

- `X_Twitter_切換到Supabase內建Provider_完成.md` - 切換指南
- `X登入設定指南-2025最新版.md` - 詳細設定指南

---

**更新日期**：2026-01-13  
**狀態**：等待 Supabase Dashboard 配置確認
