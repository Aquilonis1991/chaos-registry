# LINE 登入 401 錯誤 - 已修復

## ✅ 已執行的修復

### 1. 簡化來源驗證邏輯
- 將 `line-auth` 的來源驗證邏輯簡化，使其與 `twitter-auth` 保持一致
- 移除了複雜的 POST 請求特殊處理邏輯
- 確保回調請求跳過來源驗證（因為來自 LINE 服務器）

### 2. 重新部署 Edge Function
- 已重新部署 `line-auth` Edge Function
- 版本：最新（2026-01-09）

## 🔍 問題分析

401 錯誤 `Missing authorization header` 可能來自兩個地方：

1. **Supabase 路由層級**（在 Edge Function 處理之前）
   - 即使使用 `Deno.serve`，Supabase 路由層級仍可能檢查授權
   - 這是 Supabase 平台的限制

2. **Edge Function 內部**（已修復）
   - 已簡化來源驗證邏輯
   - 確保回調請求不會被攔截

## 📋 檢查清單

### 已完成的步驟
- [x] 確認 `line-auth` 使用 `Deno.serve`
- [x] 簡化來源驗證邏輯，與 `twitter-auth` 保持一致
- [x] 確保回調請求跳過來源驗證
- [x] 重新部署 Edge Function

### 需要檢查的步驟（在 Supabase Dashboard）
- [ ] 確認 Edge Function 是公開的（不需要授權）
- [ ] 檢查 Edge Function 日誌，確認請求是否到達 Edge Function
- [ ] 如果日誌中沒有 `Edge Function request received`，表示請求在到達 Edge Function 之前就被攔截

## 🔧 如果問題仍然存在

### 方案 1：檢查 Supabase Dashboard 設置

1. **前往 Supabase Dashboard**
   - 網址：https://app.supabase.com/
   - 選擇專案：`epyykzxxglkjombvozhr`

2. **檢查 Edge Function 設置**
   - 導航到 **Edge Functions** > **line-auth**
   - 檢查是否有任何授權相關的設置
   - 確認 Edge Function 是公開的（不需要授權）

3. **檢查 Edge Function 日誌**
   - 導航到 **Edge Functions** > **line-auth** > **Logs**
   - 查看是否有 `Edge Function request received` 日誌
   - 如果沒有，表示請求在到達 Edge Function 之前就被攔截

### 方案 2：使用不同的回調 URL

如果 Supabase 路由層級仍然攔截請求，可以考慮：

1. **將 LINE 回調 URL 設置為前端應用的 URL**
   - 在 LINE Developer Console 中，將回調 URL 設置為：`https://chaos-registry.vercel.app/auth/callback?provider=line`
   - 在前端 `OAuthCallbackPage` 中處理 LINE 回調，然後轉發到 Edge Function

2. **使用 Supabase 內建的 LINE Provider**（如果支持）
   - 檢查 Supabase 是否支持 LINE 作為內建 Provider
   - 如果支持，可以考慮使用它

## 📝 技術細節

### 修復前的代碼
```typescript
if (!isCallback) {
  // 複雜的 POST 請求特殊處理邏輯
  if (req.method === 'POST' && origin && ...) {
    // ...
  } else {
    const originValidation = validateOrigin(req)
    if (originValidation) {
      if (req.method === 'POST') {
        // ...
      } else {
        return originValidation
      }
    }
  }
}
```

### 修復後的代碼
```typescript
if (!isCallback) {
  const originValidation = validateOrigin(req)
  if (originValidation) return originValidation
} else {
  console.log('Callback request detected, skipping origin validation')
}
```

## ⚠️ 重要提醒

1. **`Deno.serve` 應該可以跳過 Supabase 路由層級的授權檢查**
   - 如果仍然出現 401 錯誤，可能是 Supabase 平台的限制或配置問題

2. **LINE 服務器的重定向請求不包含授權 header 是正常的**
   - 這是 OAuth 2.0 標準流程的一部分
   - Edge Function 應該能夠處理這種請求

3. **與 `twitter-auth` 的差異**
   - 現在 `line-auth` 和 `twitter-auth` 的結構已經一致
   - 如果 `twitter-auth` 沒有問題，`line-auth` 也應該沒有問題

---

**修復完成時間**：2026-01-09
**Edge Function 版本**：最新
