# X (Twitter) OAuth 400 Bad Request - 立即修復步驟

## ⚠️ 錯誤

**錯誤訊息**：`400 Bad Request`  
**發生位置**：X OAuth 授權 URL

**最可能的原因**：**Callback URI 不匹配**

---

## 🔧 立即修復步驟

### 步驟 1：檢查 X Developer Portal 中的 Callback URI

1. **登入 X Developer Portal**：
   - https://developer.x.com/
   - 選擇您的專案
   - 選擇您的應用程式

2. **進入 User authentication settings**：
   - 點擊 **「User authentication settings」** 標籤頁

3. **檢查 Callback URI**：
   - 當前設定：_____________（請填寫）
   - **應該設定為**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

4. **如果 Callback URI 不正確**：
   - 更新為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - **重要**：
     - ✅ 必須是 `https://`（不是 `http://`）
     - ✅ 必須完全匹配（包括域名和路徑）
     - ❌ **不能有尾隨斜線**（`/auth/v1/callback/` ❌）
     - ❌ **不能有多餘的空格**

5. **儲存設定**：
   - 點擊 **「Save」** 或 **「Update」** 按鈕
   - 等待幾秒鐘讓設定生效

---

### 步驟 2：確認其他設定

在 **User authentication settings** 頁面中，確認：

1. **App permissions**：
   - [ ] 設定為 **「Read」**

2. **Type of App**：
   - [ ] 設定為 **「Web App, Automated App or Bot」**

3. **應用程式狀態**：
   - [ ] 應用程式狀態為 **Active**
   - [ ] 沒有警告或限制

---

### 步驟 3：測試

1. **清除瀏覽器快取**（可選）
2. **重新測試 X 登入**：
   - 點擊 X (Twitter) 登入按鈕
   - 確認不再出現 400 錯誤
   - 確認可以正常跳轉到 X 授權頁面

---

## 📋 檢查清單

### X Developer Portal 設定
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] 沒有尾隨斜線
- [ ] 沒有多餘的空格
- [ ] 設定已儲存
- [ ] App permissions 設定為 "Read"
- [ ] Type of App 設定為 "Web App, Automated App or Bot"
- [ ] 應用程式狀態為 Active

### 測試
- [ ] 重新測試 X 登入功能
- [ ] 確認不再出現 400 錯誤
- [ ] 確認可以正常跳轉到 X 授權頁面

---

## 🎯 最常見的問題

### 問題 1：Callback URI 有尾隨斜線

**錯誤**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback/  ❌
```

**正確**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback  ✅
```

---

### 問題 2：Callback URI 使用錯誤的路徑

**錯誤**（舊設定）：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback  ❌
```

**正確**（新設定）：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback  ✅
```

---

### 問題 3：Callback URI 有多餘的空格

**錯誤**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback   ❌（末尾有空格）
```

**正確**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback  ✅
```

---

## 📚 相關文件

- `X_Twitter_400錯誤_解決方案.md` - 完整的解決方案說明
- `X_Twitter_400錯誤_詳細檢查清單.md` - 詳細的檢查清單
- `X_Twitter_Supabase_設定確認指南.md` - Supabase 設定確認指南

---

**請先檢查 X Developer Portal 中的 Callback URI 設定，這是最常見的原因！**
