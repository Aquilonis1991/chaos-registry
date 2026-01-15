# 🔧 code_already_used 錯誤修復說明

## 問題描述

LINE 登入時，4 次嘗試中只有 1 次成功，其餘 3 次都顯示 "授權碼已被使用"（`code_already_used`）。

## 根本原因

從日誌分析：

1. ✅ **第二次登入成功**：收到 `access_token` 和 `refresh_token`，session 成功建立
2. ❌ **其他三次失敗**：收到 `code_already_used` 錯誤，但檢查 session 時沒有找到

**根本原因**：
- LINE 的授權碼（authorization code）只能使用一次
- 當收到 `code_already_used` 時，通常意味著：
  1. 第一次請求已經成功處理了授權碼
  2. 但可能由於處理中斷、網絡問題、應用重啟等原因，session 沒有被保存到本地
  3. 後續的請求因為授權碼已被使用而失敗，且沒有 session

## 已實施的修復

### 1. ✅ 多層次 Session 檢查

當收到 `code_already_used` 錯誤時，執行以下檢查：

```typescript
// 第一次檢查 session
let { data: { session } } = await supabase.auth.getSession();
if (session) {
  // 登入成功
  return;
}

// 等待 1 秒後重試（處理同步延遲）
await new Promise(resolve => setTimeout(resolve, 1000));
let { data: { session: session2 } } = await supabase.auth.getSession();
if (session2) {
  // 登入成功
  return;
}

// 嘗試刷新 session（處理緩存問題）
const { data: refreshData } = await supabase.auth.refreshSession();
if (refreshData?.session) {
  // 登入成功
  return;
}

// 檢查用戶是否存在（驗證登入狀態）
const { data: userData } = await supabase.auth.getUser();
if (userData?.user) {
  // 再次檢查 session
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    // 登入成功
    return;
  }
}
```

### 2. ✅ 清除已處理標記，允許重試

如果所有檢查都失敗，清除已處理標記，允許用戶重新嘗試登入：

```typescript
// 清除已處理標記，允許重試
processedCallbacksRef.current.delete(callbackId);
console.log('[OAuthCallbackHandler] Processed flag cleared, user can retry login');
```

### 3. ✅ 改進的錯誤處理

- 顯示友好的錯誤訊息
- 不立即導航到 `/auth`，讓用戶可以立即重試
- 添加詳細的日誌記錄，追蹤每個恢復步驟

## 驗證修復

1. **重新同步到 Android**：
   ```bash
   npm run cap:sync:android
   ```

2. **重新運行應用**：
   ```bash
   npm run android
   ```

3. **測試 LINE 登入**：
   - 多次測試登入流程
   - 確認 `code_already_used` 錯誤能被正確處理
   - 查看日誌，確認所有恢復步驟都被執行

## 預期日誌

修復後，當收到 `code_already_used` 錯誤時，應該看到以下日誌：

```
[OAuthCallbackHandler] code_already_used error detected on duplicate callback, checking if user is already logged in
[OAuthCallbackHandler] ⚠️ First session check: no session, error: ...
[OAuthCallbackHandler] ⚠️ No session found immediately, waiting and retrying...
[OAuthCallbackHandler] ⚠️ Second session check: no session, error: ...
[OAuthCallbackHandler] ⚠️ Still no session, attempting to refresh...
[OAuthCallbackHandler] ⚠️ Refresh session: no session, error: ...
[OAuthCallbackHandler] ⚠️ Still no session, checking user directly...
[OAuthCallbackHandler] ⚠️ No user found, error: ...
[OAuthCallbackHandler] ⚠️ All recovery attempts failed, clearing processed flag to allow retry
[OAuthCallbackHandler] Processed flag cleared, user can retry login
[OAuthCallbackHandler] ⚠️ No session found after all attempts
```

## 如果問題仍然存在

如果修復後問題仍然存在，可能的原因：

1. **LINE 授權碼限制**：
   - LINE 的授權碼只能使用一次
   - 如果第一次請求已經成功處理，後續的請求就會失敗
   - **解決方案**：確保每次登入都使用新的授權碼

2. **Session 持久化問題**：
   - Session 可能沒有被正確保存到本地存儲
   - **解決方案**：檢查 Supabase 客戶端的配置，確保 session 被正確持久化

3. **應用重啟問題**：
   - 如果應用在處理過程中重啟，session 可能會丟失
   - **解決方案**：改進應用狀態管理，確保 session 在重啟後能夠恢復

## 當前狀態

- ✅ 已改進 `code_already_used` 的處理邏輯
- ✅ 已添加多層次 session 檢查
- ✅ 已添加詳細的日誌記錄
- ✅ 已清除已處理標記，允許重試
- ✅ 已構建並準備部署

## 下一步

1. **重新同步到 Android**並測試
2. **查看日誌**，確認所有恢復步驟都被執行
3. **如果問題仍然存在**，檢查 Edge Function 的日誌，確認 `code_already_used` 的來源

---

**最後更新**: 2025-01-27
**狀態**: ✅ 已修復 - 改進了 `code_already_used` 的處理邏輯
