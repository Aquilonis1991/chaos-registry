# X (Twitter) 登入 - 401 錯誤：啟用 JWT 驗證

> **建立日期**：2025-01-29  
> **發現**：LINE Edge Function 的 "Verify JWT with legacy secret" 是**啟用的**，且 LINE 登入正常

---

## 🔍 問題分析

### 發現

- **LINE Edge Function**：`Verify JWT with legacy secret` = **啟用（勾選）** ✅
- **LINE 登入**：**正常工作** ✅
- **Twitter Edge Function**：`Verify JWT with legacy secret` = **？**
- **Twitter 登入**：**失敗（401 錯誤）** ❌

### 結論

**Twitter Edge Function 的設定應該與 LINE 相同**。

---

## 🔧 解決步驟

### 步驟 1：啟用 Twitter Edge Function 的 JWT 驗證

1. **登入 [Supabase Dashboard](https://app.supabase.com/)**

2. **進入 Edge Functions**：
   - 左側選單 → **Edge Functions**

3. **找到 `twitter-auth` 函數**：
   - 在函數列表中，找到 `twitter-auth`
   - **點擊函數名稱**進入詳細頁面

4. **啟用 JWT 驗證**：
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **勾選**此選項（與 LINE 相同）
   - 點擊 **「Save」** 或 **「Update」**

5. **確認設定**：
   - 確認 `twitter-auth` 的設定與 `line-auth` 相同
   - 特別是 **「Verify JWT with legacy secret」** 選項

---

### 步驟 2：重新測試

1. **等待 10-15 秒**讓設定生效

2. **完全關閉並重新開啟應用程式**（清除快取）

3. **重新測試 Twitter 登入**：
   - 點擊 Twitter 登入按鈕
   - 完成 X 授權
   - 應該會成功登入

---

## 📝 設定對比檢查清單

請確認以下設定與 LINE 相同：

- [ ] **Verify JWT with legacy secret**：啟用（勾選）
- [ ] 其他設定與 `line-auth` 相同

---

## 🎯 如果仍然失敗

### 檢查 Edge Function 日誌

1. **進入 Edge Functions → twitter-auth → Logs**
2. **查看最近的請求日誌**
3. **查看是否有更詳細的錯誤訊息**

### 對比 LINE 和 Twitter 的完整設定

1. **截圖 `line-auth` 的設定頁面**
2. **截圖 `twitter-auth` 的設定頁面**
3. **對比兩者的所有設定**
4. **確保完全一致**

---

## 🔗 相關文件

- [X 登入-401錯誤最終解決](./X登入-401錯誤最終解決.md)
- [X 登入-EdgeFunction實作步驟](./X登入-EdgeFunction實作步驟.md)

---

**最後更新**：2025-01-29



