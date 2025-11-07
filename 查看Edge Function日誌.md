# 🔍 查看 Edge Function 日誌

## 問題

Edge Function 返回 500 錯誤和通用錯誤訊息：
```json
{"error":"Failed to create topic"}
```

這是 Edge Function 的 catch-all 錯誤處理，真正的錯誤被隱藏了。

## ✅ 查看詳細日誌

### 在 Supabase Dashboard

1. **登入** https://supabase.com/dashboard
2. **選擇** VoteChaos 專案
3. **點擊** 左側的 **Edge Functions**
4. **找到** `create-topic` 函數
5. **點擊** **Logs** 或 **Invocations**
6. **查看** 最近的錯誤日誌

### 尋找關鍵資訊

在日誌中尋找：
- 🔴 紅色的錯誤訊息
- ⚠️ Stack trace（錯誤堆疊）
- 📝 具體的錯誤原因

常見錯誤：
- `relation "xxx" does not exist` - 缺少某個表格
- `column "xxx" does not exist` - 缺少某個欄位
- `function xxx() does not exist` - 缺少某個函數
- `permission denied` - 權限問題
- `null value in column` - 資料驗證失敗

## 💡 可能的原因

### 1. 缺少基礎表格
最可能的原因是 `topics`、`profiles` 等基礎表格不存在。

### 2. 缺少 RPC 函數
Edge Function 可能呼叫了不存在的資料庫函數。

### 3. RLS 政策問題
Row Level Security 政策可能阻止了資料插入。

## 🔧 暫時的解決方案

如果無法立即查看日誌，我可以：

### 方案 A：建立一個測試用的簡化版本
不依賴 Edge Function，直接插入資料到 `topics` 表格。

### 方案 B：修復 Edge Function
需要知道具體的錯誤訊息才能修復。

---

**下一步**：
1. 前往 Supabase Dashboard → Edge Functions → create-topic → Logs
2. 查看最新的錯誤訊息
3. 將錯誤訊息告訴我

或者告訴我選擇方案 A，我建立一個簡化版本。



