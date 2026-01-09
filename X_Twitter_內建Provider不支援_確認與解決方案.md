# X (Twitter) 內建 Provider 不支援 - 確認與解決方案

## ⚠️ 錯誤

**錯誤訊息**：`"requested path is invalid"`

**原因**：Supabase **可能不支援 X (Twitter) 作為內建 Provider**。

---

## 🔍 問題分析

### 錯誤訊息分析

**`"requested path is invalid"`** 通常表示：
- Supabase 不認識該 Provider
- 或者該 Provider 的路徑配置不正確
- 或者該 Provider 不被 Supabase 支援

---

## ✅ 解決方案

### 方案 1：確認 Supabase 是否支援 X (Twitter)（優先）

**檢查步驟**：
1. 登入 Supabase Dashboard
2. 進入 Authentication → Providers
3. 查看是否有 **X (Twitter)** 或 **X** Provider
4. 如果**沒有**，表示 Supabase 不支援 X (Twitter) 作為內建 Provider
5. 如果**有**，檢查是否已正確啟用和配置

---

### 方案 2：如果 Supabase 不支援，回退到 Edge Function

**如果 Supabase 不支援 X (Twitter) 作為內建 Provider**：

1. **恢復使用 Edge Function `twitter-auth`**
2. **恢復 `handleEdgeSocialLogin('twitter')`**
3. **恢復 `OAuthCallbackPage` 中的 X (Twitter) 處理邏輯**

---

## 🔧 立即檢查步驟

### 步驟 1：檢查 Supabase Dashboard

1. **登入 Supabase Dashboard**：
   - https://app.supabase.com/
   - 選擇專案：`votechaos` (epyykzxxglkjombvozhr)

2. **進入 Authentication → Providers**：
   - 在左側選單中，點擊 **Authentication** → **Providers**
   - 查看 Provider 列表

3. **檢查是否有 X (Twitter) Provider**：
   - 查看是否有 **X (Twitter)** 或 **X** Provider
   - 如果有，檢查是否已啟用
   - 如果沒有，表示 Supabase 不支援

---

### 步驟 2：如果沒有 X (Twitter) Provider

**需要回退到 Edge Function 方案**：

1. **恢復 `handleEdgeSocialLogin` 支援 `'twitter'`**
2. **恢復 X (Twitter) 按鈕使用 `handleEdgeSocialLogin('twitter')`**
3. **恢復 `OAuthCallbackPage` 中的 X (Twitter) 處理邏輯**

---

## 📋 檢查清單

### Supabase Dashboard 檢查
- [ ] 登入 Supabase Dashboard
- [ ] 進入 Authentication → Providers
- [ ] 檢查是否有 X (Twitter) Provider
- [ ] 如果有，檢查是否已啟用和配置

### 如果沒有 X (Twitter) Provider
- [ ] 恢復使用 Edge Function `twitter-auth`
- [ ] 恢復 `handleEdgeSocialLogin('twitter')`
- [ ] 恢復 `OAuthCallbackPage` 中的 X (Twitter) 處理邏輯

---

## 📚 相關文件

- `X_Twitter_Supabase_不支援內建Provider_回退方案.md` - Supabase 不支援內建 Provider 的回退方案
- `X_Twitter_改用Supabase內建Provider_更新指南.md` - 改用 Supabase 內建 Provider 更新指南

---

**下一步**：請先檢查 Supabase Dashboard 中是否有 X (Twitter) Provider。如果沒有，我們需要回退到 Edge Function 方案。
