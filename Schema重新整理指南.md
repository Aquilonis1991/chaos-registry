# 🔄 Schema 重新整理指南

## 問題

雖然執行了 SQL，但 Supabase 的 schema cache 沒有更新，導致函數仍然找不到。

## ✅ 解決方法

### 在 Supabase Dashboard 執行

1. **SQL Editor → New Query**
2. **複製貼上** `重新整理Schema.sql` 的**全部內容**
3. **點擊 Run**

### 關鍵步驟

這個 SQL 會：
1. ✅ 刪除舊函數
2. ✅ 重新建立函數
3. ✅ **重新載入 Schema Cache**（`NOTIFY pgrst, 'reload schema'`）
4. ✅ 驗證函數已建立

### 預期結果

執行後會看到 3 個函數：
```
grant_free_create_qualification
has_free_create_qualification
use_free_create_qualification
```

## 🔄 執行後

1. **不需要重啟任何服務**
2. **直接回到瀏覽器**
3. **按 F5 重新整理**
4. **再次嘗試建立主題**

## 💡 為什麼需要 NOTIFY？

Supabase 使用 PostgREST，它會快取 schema。
`NOTIFY pgrst, 'reload schema'` 強制 PostgREST 重新載入。

## ⚠️ 如果還是找不到函數

請在 Supabase Dashboard 檢查：

### 方法 1：查看 Database → Functions
左側選單 → Database → Functions
應該看到 `has_free_create_qualification` 函數

### 方法 2：在 SQL Editor 測試
```sql
SELECT has_free_create_qualification('00000000-0000-0000-0000-000000000000');
```
應該返回 `false`（而不是「函數不存在」錯誤）

---

**立即行動**：
1. 執行 `重新整理Schema.sql`
2. 重新整理瀏覽器
3. 測試建立主題

這次應該就能解決了！



