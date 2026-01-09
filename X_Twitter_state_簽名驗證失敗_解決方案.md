# X (Twitter) OAuth state 簽名驗證失敗解決方案

## ⚠️ 新錯誤

**錯誤訊息**：
```
"error": "token signature is invalid: signature is invalid",
"msg": "400: OAuth callback with invalid state"
```

**進展**：
- ✅ JWT 格式現在是正確的（不再是 "token is malformed"）
- ❌ 但 JWT 的簽名驗證失敗

---

## 🔍 問題分析

### 問題原因

**Supabase 的內建處理邏輯**：
- Supabase 的內建 OAuth 處理邏輯會嘗試驗證 `state` 參數的 JWT 簽名
- 它期望 `state` 是由 Supabase 自己生成的（使用 Supabase 的 JWT secret）
- 但 Edge Function 生成的 `state` 使用的是 `STATE_SECRET`（從 `SERVICE_ROLE_KEY` 提取）
- 因此簽名驗證失敗

---

## 🔧 解決方案

### 方案 1：使用 Supabase 的 JWT Secret（推薦）

**策略**：使用 Supabase 的 JWT secret 來簽名 `state` 參數，這樣 Supabase 就能驗證簽名。

**實現步驟**：

1. **獲取 Supabase JWT Secret**：
   - 登入 Supabase Dashboard
   - 進入 Settings → API
   - 複製 **JWT Secret**（不是 Anon Key 或 Service Role Key）

2. **修改 Edge Function**：
   - 將 `STATE_SECRET` 改為使用 Supabase 的 JWT Secret
   - 或者添加環境變數 `SUPABASE_JWT_SECRET`

3. **重新部署 Edge Function**

**優點**：
- Supabase 能夠驗證 `state` 的簽名
- 不會出現 "signature is invalid" 錯誤

**缺點**：
- 需要獲取 Supabase 的 JWT Secret
- 需要確保 JWT Secret 的安全性

---

### 方案 2：讓 Supabase 忽略 `state` 參數（不適用）

**問題**：
- Supabase 的內建處理邏輯是服務器端的，無法直接修改
- 這不是一個可行的解決方案

---

### 方案 3：完全繞過 Supabase 的內建處理邏輯（困難）

**問題**：
- X Developer Portal 強制要求使用標準回調 URL：`/auth/v1/callback`
- 無法更改為 Edge Function 端點
- 因此無法完全繞過 Supabase 的內建處理邏輯

---

## ✅ 推薦解決方案：使用 Supabase 的 JWT Secret

### 實現步驟

#### 步驟 1：獲取 Supabase JWT Secret

1. **登入 Supabase Dashboard**：
   - https://app.supabase.com/
   - 選擇專案：`votechaos` (epyykzxxglkjombvozhr)

2. **進入 Settings → API**：
   - 找到 **JWT Secret** 欄位
   - 點擊 **Reveal** 或 **Show** 來顯示 JWT Secret
   - 複製 JWT Secret

---

#### 步驟 2：修改 Edge Function

**選項 A：使用環境變數**

1. **在 Supabase Dashboard 中設定環境變數**：
   - 進入 Edge Functions → `twitter-auth` → Settings
   - 添加環境變數：`SUPABASE_JWT_SECRET` = （您的 JWT Secret）

2. **修改 Edge Function 代碼**：
   ```typescript
   const STATE_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || SERVICE_ROLE_KEY.substring(0, 32)
   ```

**選項 B：直接在代碼中使用（不推薦，安全性較低）**

```typescript
const STATE_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || 'YOUR_JWT_SECRET_HERE'
```

---

#### 步驟 3：重新部署 Edge Function

```bash
npx supabase functions deploy twitter-auth
```

---

## 📋 檢查清單

### 獲取 JWT Secret
- [ ] 登入 Supabase Dashboard
- [ ] 進入 Settings → API
- [ ] 複製 JWT Secret

### 修改 Edge Function
- [ ] 添加環境變數 `SUPABASE_JWT_SECRET`（推薦）
- [ ] 或修改代碼使用 JWT Secret
- [ ] 重新部署 Edge Function

### 測試
- [ ] 測試 X 登入功能
- [ ] 確認不再出現 "signature is invalid" 錯誤
- [ ] 確認登入流程正常運作

---

## 🎯 預期結果

修復後：
1. ✅ Edge Function 使用 Supabase 的 JWT Secret 簽名 `state`
2. ✅ Supabase 能夠驗證 `state` 的簽名
3. ✅ 不會出現 "signature is invalid" 錯誤
4. ✅ X 登入功能應該能夠正常工作

---

## 📚 相關文件

- `X_Twitter_state_JWT格式修復完成.md` - JWT 格式修復完成
- `X_Twitter_state_格式錯誤_解決方案.md` - state 格式錯誤解決方案
- `X_Twitter_OAuth_state_參數缺失_解決方案.md` - state 參數缺失問題解決方案

---

**下一步**：獲取 Supabase 的 JWT Secret 並修改 Edge Function。
