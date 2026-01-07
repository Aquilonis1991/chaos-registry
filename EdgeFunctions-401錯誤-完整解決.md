# Edge Functions 401 錯誤 - 完整解決方案

> **建立日期**：2025-01-29  
> **錯誤**：`{"code":401,"message":"缺少授權標頭"}`  
> **影響範圍**：LINE 和 Twitter 登入都失敗

---

## 🔍 問題分析

### 錯誤訊息

```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback?code=...&state=...
{"code":401,"message":"缺少授權標頭"}
```

### 問題根源

**Supabase 在路由層級要求授權標頭**，但 OAuth 回調請求來自外部服務器（LINE 和 X），不會包含 Supabase 的 JWT。

**這是一個 Supabase Edge Functions 的配置問題**，需要在 Supabase Dashboard 中正確設置。

---

## 🔧 解決方案

### 方案 1：確認 "Verify JWT with legacy secret" 設定（最重要）

**詳細步驟**：

1. **登入 [Supabase Dashboard](https://app.supabase.com/)**

2. **進入 Edge Functions**：
   - 左側選單 → **Edge Functions**

3. **檢查 `line-auth` 函數**：
   - 在函數列表中，找到 `line-auth`
   - **點擊函數名稱**進入詳細頁面
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **確認是否真的啟用**（勾選）
   - 如果沒有啟用，**啟用它**
   - 點擊 **「Save」** 或 **「Update」**

4. **檢查 `twitter-auth` 函數**：
   - 在函數列表中，找到 `twitter-auth`
   - **點擊函數名稱**進入詳細頁面
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **啟用它**（與 LINE 相同）
   - 點擊 **「Save」** 或 **「Update」**

5. **等待 30-60 秒**讓設定生效

---

### 方案 2：檢查 Supabase 專案的全域設定

**檢查 Edge Functions 的全域設定**：

1. **進入 Settings → Edge Functions**

2. **檢查全域設定**：
   - 查看是否有 **「Require JWT for all functions」** 的選項
   - 如果有，確認是否啟用
   - 如果啟用，**關閉**它（或為特定函數設置例外）

---

### 方案 3：重新部署 Edge Functions

**如果設定都正確，嘗試重新部署**：

```bash
cd votechaos-main
npx supabase functions deploy line-auth
npx supabase functions deploy twitter-auth
```

---

### 方案 4：檢查 Edge Function 日誌

**查看詳細錯誤資訊**：

1. **進入 Edge Functions → line-auth → Logs**
2. **查看最近的請求日誌**：
   - 找到返回 401 錯誤的請求
   - 查看完整的錯誤訊息
   - 查看請求詳情（headers、method、path 等）

3. **進入 Edge Functions → twitter-auth → Logs**
4. **查看最近的請求日誌**：
   - 找到返回 401 錯誤的請求
   - 查看完整的錯誤訊息
   - 查看請求詳情（headers、method、path 等）

---

## 🎯 優先行動

### 立即檢查（按順序）

1. **✅ 確認 "Verify JWT with legacy secret" 設定**（最重要）
   - 檢查 `line-auth` 函數的設定
   - 檢查 `twitter-auth` 函數的設定
   - 確保兩者都**啟用**（勾選）

2. **✅ 等待 30-60 秒**讓設定生效

3. **✅ 重新測試**：
   - 完全關閉並重新開啟應用程式（清除快取）
   - 測試 LINE 登入
   - 測試 Twitter 登入

4. **✅ 如果仍然失敗**：
   - 檢查 Edge Function 日誌
   - 檢查 Supabase 專案的全域設定
   - 重新部署 Edge Functions

---

## 📝 需要確認的資訊

請提供以下資訊：

1. **Edge Functions 設定截圖**：
   - `line-auth` 函數的設定頁面截圖
   - `twitter-auth` 函數的設定頁面截圖
   - 特別是 **「Verify JWT with legacy secret」** 選項的狀態

2. **Edge Function 日誌**：
   - `line-auth` 函數的最近請求日誌
   - `twitter-auth` 函數的最近請求日誌
   - 完整的錯誤訊息

3. **Supabase 專案設定**：
   - Settings → Edge Functions 的全域設定截圖

---

## 🔗 相關文件

- [X 登入-401錯誤-啟用JWT驗證](./X登入-401錯誤-啟用JWT驗證.md)
- [X 登入-401錯誤最終解決](./X登入-401錯誤最終解決.md)

---

**最後更新**：2025-01-29




