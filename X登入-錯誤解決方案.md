# X (Twitter) 登入 - 錯誤解決方案

> **建立日期**：2025-01-29  
> **錯誤**：瀏覽器中顯示 `{"error":"請求的路徑無效"}`  
> **來源**：Supabase 返回的錯誤

---

## 🔍 錯誤分析

### 錯誤來源

瀏覽器中顯示的 `{"error":"請求的路徑無效"}` 是從 Supabase 返回的錯誤，表示：

1. ✅ OAuth URL 已成功生成
2. ✅ 瀏覽器已打開
3. ❌ Supabase 在處理 OAuth 請求時拒絕了 `redirect_to` 參數

### 可能的原因

1. **Supabase URL Configuration 設定問題**：
   - Deep Link 可能未正確註冊
   - 或格式不正確

2. **Supabase Provider 配置問題**：
   - Twitter Provider 可能未正確啟用
   - 或憑證有問題

3. **Supabase 版本或限制**：
   - 某些 Supabase 版本可能不支援 Deep Link 作為 `redirect_to`
   - 可能需要使用不同的方式

---

## 🔧 解決方案

### 方案 1：檢查 Supabase URL Configuration（優先）

**步驟**：

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 進入 **Authentication** → **URL Configuration**
3. **確認 Redirect URLs 列表**：
   - 必須包含：`votechaos://auth/callback`
   - 確認沒有多餘的空格
   - 確認格式完全正確

4. **如果已存在，嘗試重新添加**：
   - 刪除現有的 `votechaos://auth/callback`
   - 重新添加：`votechaos://auth/callback`
   - 點擊 **Save**
   - 等待 30 秒

5. **檢查 Site URL**：
   - 確認 **Site URL** 設定正確
   - 通常是：`https://chaos-registry.vercel.app` 或留空

---

### 方案 2：使用 Web URL 作為 redirectTo（臨時測試）

**目的**：確認問題是否特定於 Deep Link

**修改 `src/pages/AuthPage.tsx`**：

暫時修改 `redirectTo` 使用 Web URL 而不是 Deep Link：

```typescript
const redirectUrl = isNative() 
  ? `${publicSiteUrl}/auth/callback`  // 暫時使用 Web URL
  : `${publicSiteUrl}/home`;
```

**測試步驟**：

1. 修改代碼
2. 重新建置：`npm run build`
3. 同步到 Android：`npx cap sync android`
4. 測試 Twitter 登入
5. 觀察是否成功

**如果 Web URL 成功**：
- 問題可能是 Deep Link 的處理方式
- 需要檢查 Supabase 對 Deep Link 的支援

**如果 Web URL 也失敗**：
- 問題可能是 Supabase Provider 配置
- 或 X Developer Portal 設定

---

### 方案 3：檢查 Supabase Provider 實際狀態

**詳細檢查步驟**：

1. **登入 Supabase Dashboard**
2. **進入 Authentication → Providers → X (Twitter)**
3. **截圖保存當前狀態**（包含所有欄位和設定）
4. **確認**：
   - 開關是否真的啟用（綠色/開啟狀態）
   - API Key 是否完全正確（沒有多餘空格）
   - API Secret Key 是否完全正確
   - 是否有任何錯誤訊息或警告

5. **嘗試重新設定**：
   - 關閉開關（停用）
   - 等待 5 秒
   - 重新啟用
   - 重新輸入 API Key 和 Secret Key
   - 點擊 **Save**
   - 等待 30 秒

---

### 方案 4：檢查 X Developer Portal Callback URI

**確認步驟**：

1. 登入 [X Developer Portal](https://developer.x.com/)
2. 進入您的專案和應用程式
3. 進入 **User authentication settings**
4. **確認 Callback URI**：
   - 必須是：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - 不能是：`votechaos://auth/callback`
   - 確認 URL 完全匹配，沒有多餘空格

5. **確認應用程式狀態**：
   - 狀態必須是 **Active**
   - 不能是 **Suspended** 或 **Pending**

---

### 方案 5：查看 Supabase Authentication Logs

**檢查步驟**：

1. 登入 Supabase Dashboard
2. 進入 **Authentication** → **Logs**
3. **查看最近的認證請求**：
   - 找到 Twitter 相關的請求
   - 查看請求的詳細資訊
   - 查看錯誤訊息

4. **記錄**：
   - 請求時間
   - 請求狀態
   - 錯誤訊息
   - 請求參數

---

### 方案 6：使用 Supabase Management API 檢查

**進階方法**（需要 Access Token）：

1. **獲取 Supabase Access Token**：
   - 在 Supabase Dashboard → Settings → Access Tokens
   - 創建新的 Access Token

2. **使用 API 檢查 Provider 狀態**：
   ```bash
   curl -X GET \
     'https://api.supabase.com/v1/projects/epyykzxxglkjombvozhr/auth/providers' \
     -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
     -H 'Content-Type: application/json'
   ```

3. **檢查返回的 Provider 配置**

---

## 🎯 優先行動

### 立即檢查（最重要）

1. **Supabase URL Configuration**：
   - 確認 `votechaos://auth/callback` 在列表中
   - 確認格式完全正確
   - 嘗試重新添加

2. **Supabase Provider 狀態**：
   - 確認 X Provider 真的啟用
   - 確認憑證正確
   - 嘗試重新設定

3. **X Developer Portal Callback URI**：
   - 確認是 Supabase 的回調 URL
   - 不是 Deep Link

### 測試步驟

1. **使用 Web URL 測試**（方案 2）：
   - 暫時修改 `redirectTo` 使用 Web URL
   - 測試是否成功
   - 這可以確認問題是否特定於 Deep Link

2. **查看 Supabase Logs**（方案 5）：
   - 查看實際的錯誤詳情
   - 了解 Supabase 為什麼拒絕請求

---

## 📝 診斷資訊收集

請提供以下資訊：

1. **Supabase URL Configuration 截圖**：
   - 顯示 Redirect URLs 列表
   - 確認 `votechaos://auth/callback` 的實際格式

2. **Supabase Provider 設定截圖**：
   - 顯示 X Provider 的完整設定頁面
   - 隱藏敏感資訊（API Secret Key）

3. **Supabase Authentication Logs**：
   - 最近的 Twitter 登入請求
   - 錯誤詳情

4. **測試結果**：
   - 使用 Web URL 測試的結果
   - 是否成功或仍然失敗

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X 登入問題排查步驟](./X登入問題排查步驟.md)
- [X 登入-進階排查](./X登入-進階排查.md)
- [X 登入-日誌分析與下一步](./X登入-日誌分析與下一步.md)

---

**最後更新**：2025-01-29


