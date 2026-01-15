# LINE 登入 - 重複請求問題解決方案

## ❌ 問題描述

**錯誤訊息**：`"invalid_grant", "error_description": "invalid authorization code"`

**原因**：
- 多個回調請求同時到達 Edge Function
- OAuth authorization code 只能使用一次
- 第一個請求成功後，後續請求會失敗

---

## 🔍 問題分析

從日誌可以看到：
1. 有多個回調請求同時到達（多次 "LINE callback received"）
2. 第一個請求成功處理 authorization code
3. 後續請求嘗試使用同一個 code，導致 "invalid_grant" 錯誤

**根本原因**：
- 前端可能發送多個請求（重試、網路問題、用戶多次點擊）
- 瀏覽器可能自動重試失敗的請求
- Edge Function 沒有防止重複處理的機制

---

## ✅ 解決方案

### 方案 1：改進錯誤處理（已實施）

在 Edge Function 中添加對 "invalid_grant" 錯誤的特殊處理：

```typescript
// 如果是 "invalid_grant" 錯誤，可能是重複請求（authorization code 已被使用）
// 這種情況下，第一個請求已經成功，後續請求會失敗
// 我們應該返回一個友好的錯誤，而不是拋出異常
if (errorData.error === 'invalid_grant' && errorData.error_description?.includes('invalid authorization code')) {
  console.warn('Authorization code already used (likely duplicate request):', code.substring(0, 10) + '...')
  const errorUrl = getErrorRedirectUrl('code_already_used', 'Authorization code has already been used. Please try logging in again.')
  // 返回友好的錯誤訊息
}
```

**優點**：
- 不需要額外的數據庫表
- 簡單快速
- 改善用戶體驗（不再顯示技術錯誤）

**缺點**：
- 仍然會有多個請求到達 LINE API
- 不是完全防止重複請求

---

### 方案 2：使用數據庫追蹤已使用的 Code（推薦，未來改進）

創建一個臨時表來追蹤已使用的 authorization code：

```sql
CREATE TABLE IF NOT EXISTS oauth_used_codes (
  code_hash TEXT PRIMARY KEY,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL DEFAULT 'line'
);

-- 自動清理 5 分鐘前的記錄
CREATE OR REPLACE FUNCTION cleanup_old_oauth_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_used_codes
  WHERE used_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;
```

在 Edge Function 中：

```typescript
// 在處理 authorization code 之前，檢查是否已使用
const codeHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
const codeHashHex = Array.from(new Uint8Array(codeHash))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('')

const { data: existingCode } = await supabase
  .from('oauth_used_codes')
  .select('code_hash')
  .eq('code_hash', codeHashHex)
  .single()

if (existingCode) {
  // Code 已被使用，返回友好錯誤
  console.warn('Authorization code already used:', codeHashHex.substring(0, 10) + '...')
  return new Response(/* 友好錯誤訊息 */)
}

// 標記 code 為已使用（在成功交換 token 之前）
await supabase
  .from('oauth_used_codes')
  .insert({ code_hash: codeHashHex, provider: 'line' })
```

**優點**：
- 完全防止重複處理
- 減少對 LINE API 的請求
- 更安全

**缺點**：
- 需要創建數據庫表
- 需要定期清理舊記錄
- 稍微複雜一些

---

### 方案 3：前端防止重複請求（已部分實施）

在 `OAuthCallbackHandler.tsx` 中已經有 `isProcessing` 標誌：

```typescript
if (isProcessing) {
  console.log('[OAuthCallbackHandler] Already processing OAuth callback, ignoring duplicate');
  return;
}
```

**改進建議**：
1. 確保 `isProcessing` 在所有情況下都能正確重置
2. 添加請求去重邏輯（使用 request ID 或 timestamp）
3. 添加請求超時處理

---

## 📋 當前狀態

### 已實施

- ✅ 改進錯誤處理：對 "invalid_grant" 錯誤返回友好訊息
- ✅ 前端有 `isProcessing` 標誌防止重複處理

### 待改進

- ⚠️ 添加數據庫追蹤機制（方案 2）
- ⚠️ 改進前端請求去重邏輯
- ⚠️ 添加請求超時處理

---

## 🎯 建議的改進步驟

### 步驟 1：部署當前修復

1. 重新部署 Edge Function：
   ```bash
   supabase functions deploy line-auth
   ```

2. 測試 LINE 登入：
   - 確認錯誤訊息更友好
   - 確認登入仍然可以成功

### 步驟 2：實施數據庫追蹤（可選）

如果需要完全防止重複請求：

1. 創建數據庫表（見方案 2）
2. 更新 Edge Function 代碼
3. 設置定期清理任務

### 步驟 3：改進前端邏輯（可選）

1. 改進 `isProcessing` 邏輯
2. 添加請求去重
3. 添加超時處理

---

## 💡 重要提醒

### Authorization Code 特性

- **只能使用一次**：OAuth 2.0 的 authorization code 設計為只能使用一次
- **短暫有效**：通常只有幾分鐘的有效期
- **一次性**：使用後立即失效

### 為什麼會有多個請求？

1. **瀏覽器行為**：
   - 自動重試失敗的請求
   - 多個標籤頁同時處理回調

2. **網路問題**：
   - 請求超時導致重試
   - 網路不穩定導致重複發送

3. **用戶行為**：
   - 多次點擊按鈕
   - 快速刷新頁面

---

## 📝 測試建議

1. **正常登入**：
   - 確認單次登入可以成功
   - 確認沒有錯誤訊息

2. **重複請求測試**：
   - 快速多次點擊登入按鈕
   - 確認只有一次成功，其他返回友好錯誤

3. **網路問題測試**：
   - 模擬網路延遲
   - 確認重試不會導致問題

---

**更新日期**：2026-01-14  
**狀態**：已添加錯誤處理改進，建議未來實施數據庫追蹤機制
