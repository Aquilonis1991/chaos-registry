# X (Twitter) 登入 - Supabase URL Configuration 檢查

> **建立日期**：2025-01-29  
> **錯誤**：`{"error":"請求的路徑無效"}`  
> **最可能原因**：Deep Link 未在 Supabase 中註冊

---

## 🎯 問題說明

當 Supabase 收到 OAuth 回調請求時，會檢查 `redirectTo` URL 是否在允許的列表中。如果 `votechaos://auth/callback` 未在 Supabase 的 URL Configuration 中註冊，就會出現 "請求的路徑無效" 錯誤。

---

## ✅ 檢查步驟

### 步驟 1：進入 Supabase URL Configuration

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
3. 進入 **Authentication** → **URL Configuration**
   - 或 **Settings** → **Authentication** → **Redirect URLs**

### 步驟 2：檢查 Redirect URLs 列表

在 **Redirect URLs** 區塊中，應該看到以下 URL：

**必須包含**：
- ✅ `votechaos://auth/callback`（App 版 Deep Link）

**建議包含**：
- ✅ `https://chaos-registry.vercel.app/home`（Web 版）
- ✅ `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`（Supabase 回調）

### 步驟 3：添加缺失的 URL

如果列表中**沒有** `votechaos://auth/callback`：

1. 點擊 **「Add URL」** 或 **「+」** 按鈕
2. 在輸入框中輸入：
   ```
   votechaos://auth/callback
   ```
3. 點擊 **「Save」** 或 **「Add」**
4. ⚠️ **重要**：等待 10-30 秒讓設定生效
5. 重新測試 Twitter 登入

---

## 📸 預期的設定畫面

**Supabase URL Configuration 應該如下**：

```
Redirect URLs
┌─────────────────────────────────────────┐
│ votechaos://auth/callback               │ ← 必須有這個
│ https://chaos-registry.vercel.app/home  │
│ https://epyykzxxglkjombvozhr.supabase...│
└─────────────────────────────────────────┘

[+ Add URL] [Save]
```

---

## ⚠️ 常見錯誤

### 錯誤 1：URL 格式錯誤

❌ **錯誤**：
```
votechaos://auth/callback/  ← 多餘的斜線
votechaos://auth           ← 缺少路徑
votechaos://               ← 不完整
```

✅ **正確**：
```
votechaos://auth/callback
```

### 錯誤 2：大小寫錯誤

❌ **錯誤**：
```
VoteChaos://auth/callback  ← 大小寫不一致
```

✅ **正確**：
```
votechaos://auth/callback  ← 必須與 AndroidManifest.xml 中的完全一致
```

### 錯誤 3：路徑不匹配

❌ **錯誤**：
```
votechaos://callback       ← 路徑不完整
```

✅ **正確**：
```
votechaos://auth/callback  ← 必須與前端代碼中的 redirectTo 完全一致
```

---

## 🔍 驗證設定

### 方法 1：在 Supabase Dashboard 中檢查

1. 進入 Authentication → URL Configuration
2. 確認 `votechaos://auth/callback` 在列表中
3. 確認沒有多餘的空格或特殊字元

### 方法 2：檢查前端代碼

確認 `src/pages/AuthPage.tsx` 中的 `redirectTo` 與 Supabase 中的 URL 完全一致：

```typescript
const redirectUrl = isNative() 
  ? 'votechaos://auth/callback'  // ← 必須與 Supabase 中的完全一致
  : `${publicSiteUrl}/home`;
```

### 方法 3：檢查 AndroidManifest.xml

確認 `android/app/src/main/AndroidManifest.xml` 中的 Deep Link 設定：

```xml
<data
    android:scheme="votechaos"
    android:host="auth"
    android:pathPrefix="/callback" />
```

這應該與 Supabase 中的 URL 匹配。

---

## 🐛 如果仍然失敗

如果添加了 URL 後仍然出現錯誤：

1. **等待更長時間**：
   - Supabase 設定可能需要 30-60 秒才能完全生效
   - 嘗試等待 1 分鐘後再測試

2. **清除快取**：
   - 在 Android Studio 中清除 App 資料
   - 重新安裝 App

3. **檢查 Supabase 日誌**：
   - 進入 Authentication → Logs
   - 查看最近的認證請求
   - 檢查是否有更詳細的錯誤訊息

4. **確認 Provider 已啟用**：
   - 進入 Authentication → Providers
   - 確認 X (Twitter) Provider 已啟用
   - 確認 API Key 和 Secret Key 已正確填入

---

## 📝 檢查清單

- [ ] 已進入 Supabase URL Configuration 頁面
- [ ] 已檢查 Redirect URLs 列表
- [ ] `votechaos://auth/callback` 已在列表中
- [ ] URL 格式正確（沒有多餘空格或斜線）
- [ ] 已點擊 Save 儲存設定
- [ ] 已等待 10-30 秒讓設定生效
- [ ] 已重新測試 Twitter 登入

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X 登入問題排查步驟](./X登入問題排查步驟.md)
- [X 登入深度除錯指南](./X登入深度除錯指南.md)

---

**最後更新**：2025-01-29





