# Twitter 登入測試流程

**測試日期**: 2025年1月  
**測試目標**: 驗證 Twitter 登入回調修復是否正常工作

---

## 📱 測試前準備

### 1. 環境檢查

- [ ] ✅ 應用已重新構建（包含最新修復）
- [ ] ✅ Edge Function 已部署（包含修復）
- [ ] ✅ 環境變數已正確設置：
  - `FRONTEND_DEEP_LINK`: `votechaos://auth/callback`
  - `FRONTEND_URL`: 網頁版 URL
- [ ] ✅ Android 設備已連接（或模擬器已啟動）
- [ ] ✅ Logcat 已打開並過濾 `VoteChaos` 標籤

### 2. 清理狀態

```bash
# 清理應用數據（可選）
adb shell pm clear com.votechaos.app.debug

# 或手動在設備上：
# 設置 → 應用 → VoteChaos → 清除數據
```

---

## 🔄 完整測試流程

### 步驟 1: 啟動應用

1. **打開應用**
   - 點擊應用圖標啟動 VoteChaos
   - 等待應用完全載入

2. **檢查初始狀態**
   - [ ] 應用正常啟動
   - [ ] 顯示登入頁面（如果未登入）
   - [ ] 沒有錯誤提示

3. **查看 Logcat**
   ```
   應該看到：
   [VoteChaos] MainActivity onCreate start
   [VoteChaos] MainActivity onCreate complete
   [VoteChaos] MainActivity onStart
   [VoteChaos] MainActivity onResume
   ```

---

### 步驟 2: 點擊 Twitter 登入按鈕

1. **找到 Twitter 登入按鈕**
   - 在登入頁面找到「使用 X (Twitter) 登入」按鈕
   - 確認按鈕可見且可點擊

2. **點擊按鈕**
   - 點擊「使用 X (Twitter) 登入」按鈕

3. **檢查日誌輸出**
   ```
   應該看到：
   [AuthPage] handleEdgeSocialLogin called for provider: twitter
   [AuthPage] isNative(): true
   [AuthPage] Platform: app, Function: twitter-auth
   [AuthPage] Calling Edge Function: twitter-auth
   [AuthPage] Edge Function response received
   [AuthPage] Auth URL: https://twitter.com/i/oauth2/authorize?...
   [AuthPage] Redirecting to OAuth page
   ```

4. **預期行為**
   - [ ] 沒有錯誤提示
   - [ ] WebView 開始載入 Twitter 授權頁面

---

### 步驟 3: Twitter 授權頁面

1. **檢查 Twitter 授權頁面**
   - [ ] WebView 顯示 Twitter 登入頁面
   - [ ] 可以看到 Twitter/X 的授權界面
   - [ ] 顯示應用名稱和權限請求

2. **查看 Logcat**
   ```
   應該看到：
   [VoteChaos] WebView shouldOverrideUrlLoading: https://twitter.com/i/oauth2/authorize?...
   [Capacitor] App paused
   ```

3. **預期行為**
   - [ ] 應用進入暫停狀態（正常，因為打開了 WebView）
   - [ ] Twitter 授權頁面正常顯示

---

### 步驟 4: 完成授權

1. **在 Twitter 授權頁面**
   - 輸入 Twitter 帳號和密碼（如果需要）
   - 點擊「授權」或「允許」按鈕

2. **等待重定向**
   - Twitter 會重定向到 Supabase callback URL
   - 等待幾秒鐘讓 Edge Function 處理

3. **查看 Logcat**
   ```
   應該看到：
   [VoteChaos] WebView shouldOverrideUrlLoading: https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback?code=...&state=...
   ```

4. **預期行為**
   - [ ] WebView 載入 Supabase callback URL
   - [ ] Edge Function 開始處理回調

---

### 步驟 5: Edge Function 處理回調

1. **檢查 Edge Function 日誌**
   - 在 Supabase Dashboard → Edge Functions → twitter-auth → Logs
   - 查看是否有新的日誌

2. **預期日誌**
   ```
   [CRITICAL] GET callback from Supabase standard callback URL
   [CRITICAL] Detected platform from state: app
   [CRITICAL] App platform detected, redirecting to Deep Link
   [CRITICAL] Redirecting to Deep Link: votechaos://auth/callback?code=...&state=...
   ```

3. **預期行為**
   - [ ] Edge Function 檢測到 `platform='app'`
   - [ ] 返回包含 Deep Link 的 HTML 頁面

---

### 步驟 6: Deep Link 觸發應用

1. **檢查應用是否打開**
   - [ ] 應用自動打開（如果被外部瀏覽器打開）
   - [ ] 或應用從背景恢復到前景

2. **查看 Logcat**
   ```
   應該看到：
   [app-lifecycle] ========== DEEP LINK RECEIVED ==========
   [app-lifecycle] App opened with URL: votechaos://auth/callback?code=...&state=...
   [app-lifecycle] URL scheme: votechaos
   [app-lifecycle] URL hostname: auth
   [app-lifecycle] URL pathname: /callback
   [app-lifecycle] OAuth callback detected, extracting parameters...
   [app-lifecycle] Query param: code = ...
   [app-lifecycle] Query param: state = ...
   [app-lifecycle] Query param: provider = twitter
   [app-lifecycle] Query param: platform = app
   [app-lifecycle] All extracted params: {...}
   [app-lifecycle] Dispatching oauth-callback event...
   ```

3. **預期行為**
   - [ ] Deep Link 被正確解析
   - [ ] `oauth-callback` 事件被派發

---

### 步驟 7: OAuthCallbackHandler 處理

1. **檢查 OAuthCallbackHandler 日誌**
   ```
   應該看到：
   [OAuthCallbackHandler] handleOAuthCallback called
   [OAuthCallbackHandler] Processing OAuth callback
   [OAuthCallbackHandler] Callback parameters: {...}
   [OAuthCallbackHandler] Has code: true
   [OAuthCallbackHandler] Has state: true
   [OAuthCallbackHandler] Has access_token: false
   [OAuthCallbackHandler] Code and state found, calling Edge Function to exchange tokens
   ```

2. **預期行為**
   - [ ] OAuthCallbackHandler 檢測到 `code` 和 `state`
   - [ ] 開始調用 Edge Function 交換 tokens

---

### 步驟 8: Edge Function 交換 Tokens

1. **檢查 Edge Function 日誌**
   ```
   應該看到：
   Twitter callback received
   Handling callback request
   State verification successful
   Exchanging authorization code for access token
   Getting user info from Twitter
   Creating/updating user in Supabase
   Generating magic link
   ```

2. **預期行為**
   - [ ] Edge Function 成功交換 tokens
   - [ ] 用戶資訊被創建或更新
   - [ ] 返回 magic link 或包含 tokens 的 Deep Link

---

### 步驟 9: 設置 Session

1. **檢查 OAuthCallbackHandler 後續處理**
   ```
   應該看到：
   [OAuthCallbackHandler] Edge Function returned redirect URL (Twitter): ...
   [OAuthCallbackHandler] Edge Function returned Deep Link, triggering appUrlOpen event
   [OAuthCallbackHandler] Setting session from OAuth callback tokens
   [OAuthCallbackHandler] Session set successfully, user authenticated: ...
   ```

2. **預期行為**
   - [ ] Session 成功設置
   - [ ] 用戶已認證

---

### 步驟 10: 導向首頁

1. **檢查導航**
   - [ ] 顯示「登入成功！」提示
   - [ ] 自動導向到首頁 `/home`
   - [ ] 首頁正常顯示

2. **查看 Logcat**
   ```
   應該看到：
   [OAuthCallbackHandler] Session set successfully
   [OAuthCallbackHandler] Navigating to /home
   ```

3. **驗證登入狀態**
   - [ ] 用戶資訊正確顯示
   - [ ] 可以正常使用應用功能

---

## ✅ 成功標準

### 必須滿足的條件

- [ ] ✅ 點擊 Twitter 登入按鈕後，WebView 正常載入授權頁面
- [ ] ✅ 完成授權後，應用自動打開（或從背景恢復）
- [ ] ✅ Deep Link 被正確觸發和解析
- [ ] ✅ OAuthCallbackHandler 成功處理回調
- [ ] ✅ Edge Function 成功交換 tokens
- [ ] ✅ Session 成功設置
- [ ] ✅ 用戶自動導向到首頁
- [ ] ✅ 用戶已登入，可以正常使用應用

---

## ❌ 失敗情況處理

### 情況 1: 停留在外部瀏覽器

**症狀**: 授權後停留在外部瀏覽器，顯示網頁版登入頁

**可能原因**:
- Edge Function 沒有檢測到 `platform='app'`
- Deep Link 沒有被正確觸發

**檢查步驟**:
1. 查看 Edge Function 日誌，確認是否檢測到 `platform='app'`
2. 檢查 Deep Link 配置（AndroidManifest.xml）
3. 檢查環境變數 `FRONTEND_DEEP_LINK`

**解決方案**:
- 確認 Edge Function 環境變數設置正確
- 重新部署 Edge Function
- 檢查 state 參數是否正確包含 platform 資訊

---

### 情況 2: Deep Link 觸發但沒有處理

**症狀**: 應用打開，但沒有顯示「登入成功」提示

**可能原因**:
- OAuthCallbackHandler 沒有監聽到事件
- Deep Link 參數解析錯誤

**檢查步驟**:
1. 查看 Logcat，確認 `oauth-callback` 事件是否被派發
2. 檢查 OAuthCallbackHandler 是否在組件樹中
3. 檢查 Deep Link 參數是否正確

**解決方案**:
- 確認 `OAuthCallbackHandler` 在 `App.tsx` 中
- 檢查事件監聽器是否正確設置
- 檢查參數解析邏輯

---

### 情況 3: Edge Function 調用失敗

**症狀**: 顯示錯誤提示「登入失敗」

**可能原因**:
- Edge Function 未部署
- 環境變數未設置
- 網絡問題

**檢查步驟**:
1. 查看 Supabase Dashboard → Edge Functions → Logs
2. 檢查環境變數設置
3. 檢查網絡連接

**解決方案**:
- 重新部署 Edge Function
- 檢查環境變數
- 檢查網絡連接

---

## 🔍 調試命令

### 1. 查看應用日誌

```bash
# 過濾 VoteChaos 標籤
adb logcat -s VoteChaos

# 過濾所有相關標籤
adb logcat | grep -E "(VoteChaos|Capacitor|OAuthCallbackHandler|app-lifecycle)"
```

### 2. 查看 Edge Function 日誌

1. 登入 Supabase Dashboard
2. 導航到 Edge Functions → twitter-auth
3. 點擊「Logs」標籤
4. 查看最新的日誌

### 3. 測試 Deep Link 手動觸發

```bash
# 手動觸發 Deep Link（用於測試）
adb shell am start -a android.intent.action.VIEW -d "votechaos://auth/callback?code=test&state=test&provider=twitter&platform=app" com.votechaos.app.debug
```

---

## 📊 測試檢查清單

### 基本功能測試

- [ ] 應用正常啟動
- [ ] Twitter 登入按鈕可見且可點擊
- [ ] 點擊按鈕後 WebView 載入 Twitter 授權頁
- [ ] 授權頁面正常顯示
- [ ] 完成授權後應用自動打開
- [ ] 顯示「登入成功」提示
- [ ] 自動導向到首頁
- [ ] 用戶已登入，可以正常使用

### 日誌檢查

- [ ] MainActivity 日誌正常
- [ ] AuthPage 日誌顯示正確流程
- [ ] Edge Function 日誌顯示正確處理
- [ ] app-lifecycle 日誌顯示 Deep Link 接收
- [ ] OAuthCallbackHandler 日誌顯示正確處理

### 錯誤處理

- [ ] 如果授權失敗，顯示錯誤提示
- [ ] 如果網絡錯誤，顯示錯誤提示
- [ ] 如果 Edge Function 錯誤，顯示錯誤提示

---

## 🎯 預期結果總結

### 成功流程

```
1. 點擊 Twitter 登入
   ↓
2. WebView 載入 Twitter 授權頁
   ↓
3. 用戶完成授權
   ↓
4. Twitter 重定向到 Supabase callback
   ↓
5. Edge Function 檢測 platform='app'
   ↓
6. Edge Function 重定向到 Deep Link
   ↓
7. Deep Link 觸發應用打開
   ↓
8. OAuthCallbackHandler 處理回調
   ↓
9. 調用 Edge Function 交換 tokens
   ↓
10. 設置 session
   ↓
11. 導向首頁
   ↓
12. ✅ 登入成功！
```

---

## 📝 測試記錄模板

### 測試記錄

**測試時間**: ___________  
**測試設備**: ___________  
**Android 版本**: ___________  
**應用版本**: ___________

**測試結果**:
- [ ] ✅ 通過
- [ ] ❌ 失敗

**問題描述**（如果失敗）:
```
在此記錄問題詳情
```

**日誌截圖**（如果失敗）:
```
在此貼上相關日誌
```

---

## 🔄 重新測試步驟

如果測試失敗，請按照以下步驟重新測試：

1. **清理應用數據**
   ```bash
   adb shell pm clear com.votechaos.app.debug
   ```

2. **重新構建應用**
   ```bash
   cd votechaos-main
   npm run build
   npm run cap:sync:android
   ```

3. **重新安裝應用**
   ```bash
   cd android
   ./gradlew installDebug
   ```

4. **重新部署 Edge Function**（如果需要）
   - 在 Supabase Dashboard 中重新部署 `twitter-auth` Edge Function

5. **按照測試流程重新測試**

---

**測試指南生成時間**: 2025年1月  
**最後更新**: 2025年1月
