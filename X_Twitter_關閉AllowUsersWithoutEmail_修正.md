# X (Twitter) 關閉 "Allow users without an email" - 修正

## ✅ 重要修正

在 Supabase Dashboard → Authentication → Providers → X / Twitter (OAuth 2.0)：

**必須關閉 "Allow users without an email" 選項**

---

## 🔧 操作步驟

1. **前往 Supabase Dashboard**：
   - 登入 https://app.supabase.com/
   - 選擇您的專案

2. **進入 X / Twitter (OAuth 2.0) 設定**：
   - 導航到 **Authentication** → **Providers**
   - 找到 **X / Twitter (OAuth 2.0)**
   - 展開設定

3. **關閉 "Allow users without an email"**：
   - 找到 **"Allow users without an email"** 選項
   - **取消勾選**（關閉）
   - 點擊 **Save**

---

## 💡 為什麼要關閉？

1. **X 要求返回 email**：
   - X OAuth 2.0 要求必須返回用戶的 email
   - 如果 Supabase 允許沒有 email 的用戶登入，可能與 X 的要求衝突

2. **一致性**：
   - 如果 "Request email from users" 在 X Developer Portal 中已啟用
   - Supabase 也應該要求 email，保持一致性

3. **可能的授權失敗**：
   - 如果允許沒有 email 的用戶，X 可能認為設定不一致
   - 導致授權失敗

---

## 📋 更新後的 Supabase Dashboard 設定

在 Supabase Dashboard → Authentication → Providers → X / Twitter (OAuth 2.0)：

- ✅ **Enabled**：ON（綠色/啟用）
- ✅ **Client ID**：已填入
- ✅ **Client Secret**：已填入
- ✅ **"Allow users without an email"**：**關閉**（未勾選）⚠️ **重要修正**
- ✅ 設定已 **Save**

---

## 🎯 預期結果

關閉此選項後：

1. **Supabase 會要求 X 必須返回 email**：
   - 與 X Developer Portal 中的 "Request email from users" 設定一致
   - 確保授權流程符合 X 的要求

2. **可能解決授權問題**：
   - 如果問題是由於設定不一致導致的
   - 關閉此選項可能解決 "無法授予存取權" 的錯誤

---

## 📝 下一步

1. **關閉 "Allow users without an email" 選項**：
   - 在 Supabase Dashboard 中取消勾選
   - 點擊 **Save**

2. **確認 X Developer Portal 設定**：
   - 確認 "Request email from users" 已啟用（ON）

3. **等待設定生效**：
   - 等待 5-10 分鐘讓設定生效

4. **重新測試**：
   - 完全關閉 APP
   - 重新啟動 APP
   - 重新測試 X (Twitter) 登入

---

## 💡 相關設定檢查

確保以下設定保持一致：

### X Developer Portal
- ✅ "Request email from users"：**已啟用**（ON）

### Supabase Dashboard
- ✅ "Allow users without an email"：**已關閉**（未勾選）

這樣確保：
- X 要求返回 email
- Supabase 也要求必須有 email
- 設定完全一致

---

**更新日期**：2026-01-14  
**狀態**：需要關閉 "Allow users without an email" 選項並重新測試
