# Twitter 登入修復方案說明

**問題**: 授權後回到網頁版登入頁，而不是應用

---

## 🔍 根本原因

**Twitter 重定向到 Supabase 的內建認證端點 (`/auth/v1/callback`)，而不是 Edge Function**

1. Twitter 授權完成後重定向到: `/auth/v1/callback?code=...&state=...`
2. 這是 Supabase 的內建認證端點，不是 Edge Function 路徑
3. Supabase 內建認證系統處理這個請求
4. 因為沒有配置 Twitter Provider（或已停用），重定向到前端登入頁
5. Edge Function 的 GET callback 處理邏輯從未被調用

---

## ✅ 修復方案

### 修改 MainActivity.java

在 `MainActivity.java` 中，當檢測到 Supabase callback URL 包含 `code` 和 `state` 時：

1. **提取 `code` 和 `state` 參數**
2. **直接構建 Deep Link**: `votechaos://auth/callback?code=...&state=...&provider=twitter&platform=app`
3. **觸發 Deep Link Intent**，讓應用打開並處理回調
4. **攔截 WebView 請求**，不讓 Supabase 內建認證系統處理

這樣，`OAuthCallbackHandler` 就能接收到 Deep Link 事件，並調用 Edge Function 的 callback 端點來交換 tokens。

---

## 🔄 修復後的流程

```
1. 用戶點擊 Twitter 登入 ✅
   ↓
2. 調用 Edge Function (POST /functions/v1/twitter-auth) ✅
   ↓
3. Edge Function 生成 state (platform='app') ✅
   ↓
4. 返回 Twitter 授權 URL ✅
   ↓
5. WebView 載入 Twitter 授權頁面 ✅
   ↓
6. 用戶完成授權 ✅
   ↓
7. Twitter 重定向到: /auth/v1/callback?code=...&state=... ✅
   ↓
8. MainActivity 檢測到 Supabase callback URL ✅
   ↓
9. MainActivity 提取 code 和 state ✅
   ↓
10. MainActivity 構建 Deep Link: votechaos://auth/callback?code=...&state=... ✅
    ↓
11. MainActivity 觸發 Deep Link Intent ✅
    ↓
12. 應用打開，OAuthCallbackHandler 接收 Deep Link 事件 ✅
    ↓
13. OAuthCallbackHandler 調用 Edge Function callback 端點 ✅
    ↓
14. Edge Function 交換 tokens 並返回 Deep Link（包含 tokens）✅
    ↓
15. OAuthCallbackHandler 設置 Session ✅
    ↓
16. 導向首頁 ✅
```

---

## 📝 已修改的文件

### MainActivity.java

- 修改了 Supabase callback URL 處理邏輯
- 當檢測到 `code` 和 `state` 時，直接構建 Deep Link 並觸發
- 攔截 WebView 請求，避免 Supabase 內建認證系統處理

---

## 🧪 測試步驟

1. **重新構建應用**
   ```bash
   cd votechaos-main
   npm run build
   npm run cap:sync:android
   cd android
   ./gradlew.bat assembleDebug installDebug
   ```

2. **清理應用數據**
   ```bash
   adb shell pm clear com.votechaos.app.debug
   ```

3. **測試 Twitter 登入**
   - 啟動應用
   - 點擊 Twitter 登入按鈕
   - 完成授權
   - **應該看到**: 應用自動打開，顯示「登入成功！」提示

4. **檢查 Logcat**
   ```
   應該看到：
   [VoteChaos] Supabase callback URL detected: ...
   [VoteChaos] OAuth callback detected (code and state present)
   [VoteChaos] Constructing Deep Link to trigger OAuthCallbackHandler
   [VoteChaos] Triggering Deep Link: votechaos://auth/callback?code=...&state=...
   [VoteChaos] Deep Link Intent started successfully
   [app-lifecycle] ========== DEEP LINK RECEIVED ==========
   [OAuthCallbackHandler] Code and state found, calling Edge Function
   ```

---

## ⚠️ 注意事項

1. **Edge Function 必須已部署最新版本**
2. **環境變數必須正確設置**:
   - `FRONTEND_DEEP_LINK`: `votechaos://auth/callback`
   - `FRONTEND_URL`: 您的網頁版 URL
   - `JWT_SECRET`: 從 Supabase Settings → API 獲取

3. **如果問題仍然存在**:
   - 檢查 Logcat 是否看到 "Deep Link Intent started successfully"
   - 檢查是否看到 "DEEP LINK RECEIVED"
   - 檢查 OAuthCallbackHandler 是否調用 Edge Function

---

**最後更新**: 2025年1月
