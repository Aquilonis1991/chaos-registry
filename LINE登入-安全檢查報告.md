# LINE 登入 - 安全檢查報告

> **檢查日期**：2025-12-05  
> **狀態**：發現多個安全問題，需要修復

---

## 🔴 嚴重安全問題

### 1. **缺少 State 參數驗證（CSRF 漏洞）**

**問題**：
- 代碼生成了 `state` 參數用於防止 CSRF 攻擊
- 但在回調處理中**沒有驗證** `state` 是否匹配
- 攻擊者可以偽造回調請求，導致未授權登入

**位置**：
- `handleAuthRequest`：生成 state（第 96 行）
- `handleCallback`：接收 state 但**沒有驗證**（第 140-154 行）

**風險等級**：🔴 **高**

**修復建議**：
- 使用 Session Storage 或 Redis 存儲 state
- 在回調中驗證 state 是否匹配
- 驗證後立即刪除 state（一次性使用）

---

### 2. **JWT 簽名未驗證**

**問題**：
- 代碼註釋明確說明："實際應用中應該驗證 JWT 簽名，這裡簡化處理"
- 直接解析 ID Token 的 payload，沒有驗證簽名
- 攻擊者可以偽造 ID Token

**位置**：
- `handleCallback`：第 234-235 行

**風險等級**：🔴 **高**

**修復建議**：
- 使用 LINE 的公鑰驗證 JWT 簽名
- 或使用 LINE 的驗證端點驗證 ID Token

---

### 3. **Nonce 驗證不完整**

**問題**：
- 有 nonce 驗證邏輯，但因為 JWT 簽名未驗證，nonce 驗證也不可靠
- 如果 nonce 不匹配，只記錄警告，不拋出錯誤

**位置**：
- `handleCallback`：第 237-241 行

**風險等級**：🟡 **中**

**修復建議**：
- 先修復 JWT 簽名驗證
- 如果 nonce 不匹配，應該拒絕請求

---

## 🟡 中等安全問題

### 4. **硬編碼的密鑰（開發環境）**

**問題**：
- `LINE_CHANNEL_SECRET` 有硬編碼的默認值
- 如果環境變數未設置，會使用硬編碼的值

**位置**：
- 第 7 行：`const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') || '079ebaa784b4c00184e68bafb1841d77'`

**風險等級**：🟡 **中**（僅在生產環境）

**修復建議**：
- 移除硬編碼的默認值
- 如果環境變數未設置，應該拋出錯誤

---

### 5. **錯誤訊息可能洩露敏感資訊**

**問題**：
- 錯誤訊息可能包含敏感資訊（如用戶 ID、email）
- 日誌記錄了完整的請求頭（可能包含敏感資訊）

**位置**：
- 多處錯誤處理和日誌記錄

**風險等級**：🟡 **中**

**修復建議**：
- 在生產環境中，不要記錄敏感資訊
- 錯誤訊息應該通用化，不洩露內部細節

---

## 🟢 低風險問題

### 6. **未使用的代碼**

**問題**：
- 第 425-444 行有未使用的代碼（在 return 之後）
- 這不會造成安全問題，但應該清理

**風險等級**：🟢 **低**

**修復建議**：
- 刪除未使用的代碼

---

## ✅ 已實現的安全措施

1. ✅ **CORS 保護**：正確處理 CORS 預檢請求
2. ✅ **Origin 驗證**：非回調請求會驗證來源
3. ✅ **JWT 驗證已關閉**：正確處理 OAuth 回調（不需要 JWT）
4. ✅ **使用 Service Role Key**：內部操作使用服務角色密鑰
5. ✅ **錯誤處理**：有基本的錯誤處理機制

---

## 🔧 優先修復順序

### 立即修復（高優先級）

1. **State 參數驗證**（CSRF 保護）
2. **JWT 簽名驗證**（防止偽造 ID Token）

### 短期修復（中優先級）

3. **Nonce 驗證加強**
4. **移除硬編碼密鑰**
5. **清理未使用的代碼**

### 長期改進（低優先級）

6. **錯誤訊息優化**
7. **日誌記錄優化**

---

## 📝 修復建議

### 方案 1：使用 Session Storage（推薦）

```typescript
// 在 handleAuthRequest 中存儲 state
const stateStore = new Map<string, { timestamp: number, platform: string, nonce: string }>()
const state = crypto.randomUUID()
stateStore.set(state, { timestamp: Date.now(), platform, nonce })
// 設置過期時間（5 分鐘）
setTimeout(() => stateStore.delete(state), 5 * 60 * 1000)

// 在 handleCallback 中驗證
const storedState = stateStore.get(state)
if (!storedState) {
  throw new Error('Invalid or expired state')
}
stateStore.delete(state) // 一次性使用
```

### 方案 2：使用 Redis（生產環境推薦）

- 使用 Supabase Edge Functions 的 Redis 支持
- 存儲 state 並設置過期時間
- 在回調中驗證並刪除

### JWT 簽名驗證

```typescript
// 使用 LINE 的驗證端點
const verifyResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    id_token: idToken,
    client_id: LINE_CHANNEL_ID,
  }),
})

if (!verifyResponse.ok) {
  throw new Error('Invalid ID token')
}
```

---

**最後更新**：2025-12-05



