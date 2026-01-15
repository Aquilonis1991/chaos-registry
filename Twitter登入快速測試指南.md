# Twitter 登入快速測試指南

**測試目標**: 驗證 Twitter 登入回調修復  
**預計時間**: 5-10 分鐘

---

## 🚀 快速測試步驟

### 步驟 1: 準備工作（1分鐘）

```bash
# 1. 清理應用數據（可選）
adb shell pm clear com.votechaos.app.debug

# 2. 打開 Logcat（過濾 VoteChaos 標籤）
adb logcat -s VoteChaos
```

---

### 步驟 2: 啟動應用並點擊按鈕（30秒）

1. **打開應用**
   - 點擊 VoteChaos 應用圖標
   - 等待登入頁面載入

2. **找到並點擊 Twitter 登入按鈕**
   - 在登入頁面找到「**使用 X (Twitter) 登入**」按鈕
   - **點擊按鈕**

3. **檢查日誌**（應該看到）:
   ```
   [AuthPage] handleEdgeSocialLogin called for provider: twitter
   [AuthPage] Redirecting to OAuth page
   ```

---

### 步驟 3: 完成 Twitter 授權（1-2分鐘）

1. **在 Twitter 授權頁面**
   - 如果未登入，輸入 Twitter 帳號和密碼
   - 點擊「**授權**」或「**允許**」按鈕

2. **等待重定向**
   - 等待 3-5 秒讓 Edge Function 處理

3. **檢查日誌**（應該看到）:
   ```
   [VoteChaos] WebView shouldOverrideUrlLoading: https://...supabase.co/auth/v1/callback?code=...&state=...
   ```

---

### 步驟 4: 驗證應用自動打開（10秒）

1. **檢查應用狀態**
   - [ ] 應用自動打開（或從背景恢復）
   - [ ] 顯示「**登入成功！**」提示
   - [ ] 自動導向到首頁

2. **檢查日誌**（應該看到）:
   ```
   [app-lifecycle] ========== DEEP LINK RECEIVED ==========
   [app-lifecycle] OAuth callback detected
   [OAuthCallbackHandler] Code and state found, calling Edge Function
   [OAuthCallbackHandler] Session set successfully
   ```

---

## ✅ 成功標準

### 必須看到

- [ ] ✅ 點擊按鈕後 WebView 載入 Twitter 授權頁
- [ ] ✅ 完成授權後應用自動打開
- [ ] ✅ 顯示「登入成功！」提示
- [ ] ✅ 自動導向到首頁
- [ ] ✅ 用戶已登入（可以查看個人資料）

---

## ❌ 如果失敗

### 問題 1: 停留在外部瀏覽器

**症狀**: 授權後停留在瀏覽器，顯示網頁版登入頁

**快速檢查**:
```bash
# 查看 Edge Function 日誌（Supabase Dashboard）
# 確認是否看到：
# [CRITICAL] App platform detected, redirecting to Deep Link
```

**解決**: 檢查 Edge Function 環境變數 `FRONTEND_DEEP_LINK`

---

### 問題 2: 應用打開但沒有登入

**症狀**: 應用打開，但沒有顯示「登入成功」提示

**快速檢查**:
```bash
# 查看 Logcat，確認是否看到：
# [OAuthCallbackHandler] Code and state found
# [OAuthCallbackHandler] Session set successfully
```

**解決**: 檢查 OAuthCallbackHandler 是否正確處理回調

---

### 問題 3: 顯示錯誤提示

**症狀**: 顯示「登入失敗」或其他錯誤

**快速檢查**:
```bash
# 查看完整錯誤日誌
adb logcat | grep -E "(Error|Exception|Failed)"
```

**解決**: 根據錯誤訊息進行相應修復

---

## 🔍 關鍵日誌檢查點

### 1. 點擊按鈕時
```
[AuthPage] handleEdgeSocialLogin called for provider: twitter
[AuthPage] Redirecting to OAuth page
```

### 2. 授權完成時
```
[VoteChaos] WebView shouldOverrideUrlLoading: ...supabase.co/auth/v1/callback?code=...
```

### 3. Deep Link 觸發時
```
[app-lifecycle] ========== DEEP LINK RECEIVED ==========
[app-lifecycle] OAuth callback detected
```

### 4. 處理回調時
```
[OAuthCallbackHandler] Code and state found, calling Edge Function
[OAuthCallbackHandler] Session set successfully
```

---

## 📱 按鈕位置

### 在登入頁面

1. 打開應用
2. 如果未登入，會自動顯示登入頁面
3. 找到「**使用 X (Twitter) 登入**」按鈕
   - 通常在頁面中間或下方
   - 可能顯示為「X 登入」或「Twitter 登入」

### 如果找不到按鈕

1. 檢查是否已登入（如果已登入，不會顯示登入頁）
2. 登出後重新測試
3. 檢查 UI 文字配置

---

## 🎯 測試檢查清單

### 快速檢查（30秒）

- [ ] 應用正常啟動
- [ ] 登入頁面顯示
- [ ] Twitter 登入按鈕可見
- [ ] 點擊按鈕無錯誤

### 完整測試（5分鐘）

- [ ] 點擊按鈕 → WebView 載入授權頁
- [ ] 完成授權 → 應用自動打開
- [ ] 顯示「登入成功」提示
- [ ] 自動導向首頁
- [ ] 用戶已登入

---

## 🔄 重新測試

如果測試失敗，請：

1. **清理應用數據**
   ```bash
   adb shell pm clear com.votechaos.app.debug
   ```

2. **重新構建應用**（如果需要）
   ```bash
   npm run build
   npm run cap:sync:android
   ```

3. **重新安裝應用**
   ```bash
   cd android
   ./gradlew installDebug
   ```

4. **按照步驟重新測試**

---

## 📝 測試記錄

**測試時間**: ___________  
**測試結果**: [ ] ✅ 通過  [ ] ❌ 失敗

**問題描述**（如果失敗）:
```
_________________________________________________
_________________________________________________
```

**相關日誌**（如果失敗）:
```
_________________________________________________
_________________________________________________
```

---

**快速測試指南生成時間**: 2025年1月
