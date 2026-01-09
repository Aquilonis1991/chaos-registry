# LINE 登入 401 錯誤解決方案

## ⚠️ 問題描述

當 LINE 服務器重定向到 Edge Function 的回調 URL 時，出現以下錯誤：

```
code	401
message	"Missing authorization header"

GET
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback?code=...&state=...
[HTTP/3 401  246ms]
```

## 🔍 問題分析

1. **Supabase 路由層級攔截**：即使 `line-auth` Edge Function 使用 `Deno.serve`，Supabase 的路由層級仍然在 Edge Function 處理之前就檢查授權 header。

2. **LINE 服務器重定向沒有授權 header**：LINE 服務器的 OAuth 回調重定向請求不包含授權 header，這是正常的 OAuth 流程。

3. **與 `twitter-auth` 的差異**：`twitter-auth` 似乎沒有這個問題，可能是因為配置或部署方式的差異。

## ✅ 解決方案

### 方案 1：確認 Edge Function 使用 `Deno.serve`

確認 `line-auth` Edge Function 使用 `Deno.serve` 而不是 `serve`：

```typescript
// ✅ 正確：使用 Deno.serve
Deno.serve(async (req) => {
  // ...
})

// ❌ 錯誤：使用 serve（會觸發 Supabase 路由層級的授權檢查）
serve(async (req) => {
  // ...
})
```

### 方案 2：檢查 Supabase Dashboard 配置

1. **前往 Supabase Dashboard**
   - 網址：https://app.supabase.com/
   - 選擇專案：`epyykzxxglkjombvozhr`

2. **檢查 Edge Function 設置**
   - 導航到 **Edge Functions** > **line-auth**
   - 檢查是否有任何授權相關的設置
   - 確認 Edge Function 是公開的（不需要授權）

3. **檢查 RLS 策略**
   - 導航到 **Database** > **Policies**
   - 確認沒有針對 Edge Functions 的 RLS 策略

### 方案 3：重新部署 Edge Function

如果配置正確但仍然出現問題，嘗試重新部署：

```bash
cd votechaos-main
supabase functions deploy line-auth
```

### 方案 4：檢查 Edge Function 日誌

1. **前往 Supabase Dashboard**
   - 導航到 **Edge Functions** > **line-auth** > **Logs**

2. **檢查日誌**
   - 查看是否有 `Edge Function request received` 日誌
   - 如果沒有，表示請求在到達 Edge Function 之前就被攔截了

3. **檢查 `hasAuthHeader`**
   - 如果日誌顯示 `hasAuthHeader: false`，這是正常的（LINE 服務器的重定向請求不包含授權 header）

## 🔧 臨時解決方案

如果上述方案都無法解決問題，可以考慮：

1. **使用不同的回調 URL**：將 LINE 回調 URL 設置為前端應用的 URL，然後在前端處理回調並轉發到 Edge Function。

2. **使用 Supabase 內建的 LINE Provider**：如果 Supabase 支持 LINE 作為內建 Provider，可以考慮使用它。

## 📋 檢查清單

- [ ] 確認 `line-auth` Edge Function 使用 `Deno.serve`
- [ ] 檢查 Supabase Dashboard 中的 Edge Function 設置
- [ ] 確認 Edge Function 是公開的（不需要授權）
- [ ] 檢查 Edge Function 日誌，確認請求是否到達 Edge Function
- [ ] 重新部署 Edge Function
- [ ] 檢查 `twitter-auth` 的配置，看看是否有差異

## ⚠️ 重要提醒

1. **`Deno.serve` 應該可以跳過 Supabase 路由層級的授權檢查**
   - 如果仍然出現 401 錯誤，可能是 Supabase 平台的限制或配置問題

2. **LINE 服務器的重定向請求不包含授權 header是正常的**
   - 這是 OAuth 2.0 標準流程的一部分
   - Edge Function 應該能夠處理這種請求

3. **與 `twitter-auth` 的差異**
   - 如果 `twitter-auth` 沒有這個問題，檢查兩者的配置差異
   - 可能需要相同的配置或部署方式

---

**如果問題仍然存在，請檢查 Supabase 文檔或聯繫 Supabase 支持。**
