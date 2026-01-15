# 🔧 LINE 登入間歇性失敗修復

## 問題描述

LINE 登入有時候成功，有時候失敗並導回登入頁。

## 根本原因

從日誌分析：

1. ✅ `line-auth-callback` Edge Function 成功返回 302（重定向）
2. ✅ Deep Link 正確接收到 `access_token` 和 `refresh_token`
3. ❌ **問題**：`OAuthCallbackHandler` 顯示 "Callback already processed, ignoring duplicate"

**根本原因**：
- `callbackId` 生成邏輯使用了 `url-${event.detail.url.substring(0, 50)}`
- 當 Deep Link URL 很長時（包含完整的 hash fragment），不同的 URL 可能被截斷成相同的 callbackId
- 第一次處理時標記為已處理，但可能因為某些原因沒有成功建立 session
- 第二次處理時（可能是同一事件被觸發兩次，或重新處理）被認為是重複，直接返回，沒有建立 session

## 已實施的修復

### 1. ✅ 改進 `callbackId` 生成邏輯

**優先使用 `access_token`** 生成 callbackId，因為它是最終的登入結果：

```typescript
const callbackId = params.access_token 
  ? `token-${params.access_token.substring(0, 30)}-${params.refresh_token?.substring(0, 10) || 'none'}`
  : params.code && params.state 
    ? `code-${params.code.substring(0, 10)}-${params.state.substring(0, 10)}`
    : params.error 
      ? `error-${params.error}`
      : `url-${event.detail.url.substring(0, 50)}`;
```

### 2. ✅ 重複 Callback 時檢查 Session

當 callback 被標記為已處理時，如果有 `access_token`，檢查並嘗試建立 session：

```typescript
if (processedCallbacksRef.current.has(callbackId)) {
  // 如果有 access_token，檢查並嘗試建立 session
  if (params.access_token && params.refresh_token) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Session 存在，登入成功
      navigate('/home', { replace: true });
      return;
    } else {
      // Session 不存在，嘗試建立（可能是第一次處理失敗了）
      await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token
      });
      // ...
    }
  }
}
```

### 3. ✅ 改進日誌記錄

添加更詳細的日誌，包括：
- `callbackId` 的生成過程
- Session 檢查結果
- 重複 callback 的處理邏輯

## 驗證修復

1. **重新測試 LINE 登入**
   - 多次測試 LINE 登入流程
   - 確認登入成功率提高
   - 確認不再出現 "已處理但未登入" 的情況

2. **檢查日誌**
   - 查看 `OAuthCallbackHandler` 的日誌
   - 確認 `callbackId` 正確生成
   - 確認 session 正確建立

3. **確認登入流程**
   - 確認用戶能夠成功登入
   - 確認 session 正確建立
   - 確認導航到 `/home` 正常

## 其他改進

### 1. 獨立的 Callback Edge Function

✅ **已創建** `line-auth-callback` Edge Function：
- 專用於處理 LINE 回調的 GET 請求
- 立即重定向到前端，避免觸發 JWT 驗證
- 解決了 401 錯誤問題

### 2. 改進的重複處理檢測

✅ **已改進**重複處理檢測邏輯：
- 優先使用 `access_token` 生成 callbackId
- 當檢測到重複時，檢查 session 狀態
- 如果沒有 session，嘗試建立（允許從失敗中恢復）

## 當前狀態

- ✅ 已修復 `callbackId` 生成邏輯
- ✅ 已添加重複 callback 時的 session 檢查
- ✅ 已改進日誌記錄
- ✅ 已部署獨立的 `line-auth-callback` Edge Function
- ✅ 已更新前端代碼

## 下一步

1. **重新測試**
   - 多次測試 LINE 登入流程
   - 確認登入成功率

2. **監控日誌**
   - 持續監控 Edge Function 和前端日誌
   - 確認沒有其他問題

3. **優化（可選）**
   - 考慮添加重試機制
   - 考慮添加更詳細的錯誤處理

---

**最後更新**: 2025-01-27
**狀態**: ✅ 已修復 - 改進了 callbackId 生成和重複處理邏輯
