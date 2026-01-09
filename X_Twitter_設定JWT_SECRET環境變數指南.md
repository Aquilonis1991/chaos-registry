# X (Twitter) 設定 JWT_SECRET 環境變數指南

## ⚠️ 問題

**錯誤訊息**：
```
"error": "token signature is invalid: signature is invalid",
"msg": "400: OAuth callback with invalid state"
```

**原因**：
- Supabase 的內建處理邏輯會驗證 `state` 參數的 JWT 簽名
- 它期望 `state` 是由 Supabase 自己生成的（使用 Supabase 的 JWT secret）
- Edge Function 需要使用 Supabase 的 JWT Secret 來簽名 `state` 參數

---

## 🔧 解決方案：設定 JWT_SECRET 環境變數

### 步驟 1：獲取 Supabase JWT Secret

1. **登入 Supabase Dashboard**：
   - https://app.supabase.com/
   - 選擇專案：`votechaos` (epyykzxxglkjombvozhr)

2. **進入 Settings → API**：
   - 在左側選單中，點擊 **Settings** → **API**
   - 找到 **JWT Secret** 欄位
   - 點擊 **Reveal** 或 **Show** 來顯示 JWT Secret
   - **複製 JWT Secret**（這是一個長字串）

---

### 步驟 2：在 Edge Function 中設定環境變數

1. **進入 Edge Functions**：
   - 在左側選單中，點擊 **Edge Functions**
   - 找到 **twitter-auth** 函數
   - 點擊 **twitter-auth** 進入函數詳情頁面

2. **進入 Settings**：
   - 點擊 **Settings** 標籤頁

3. **添加環境變數**：
   - 在 **Environment Variables** 區塊中
   - 點擊 **Add new variable** 或 **+** 按鈕
   - 輸入：
     - **Name**：`JWT_SECRET`
     - **Value**：貼上剛才複製的 JWT Secret
   - 點擊 **Save** 或 **Add**

---

### 步驟 3：確認環境變數已設定

1. **檢查環境變數列表**：
   - 確認 `JWT_SECRET` 已出現在環境變數列表中
   - 確認值已正確設定（不會顯示完整值，只會顯示部分字符）

2. **重新部署 Edge Function（如果需要）**：
   - 環境變數設定後，Edge Function 會自動重新載入
   - 如果沒有自動重新載入，可以手動重新部署：
     ```bash
     npx supabase functions deploy twitter-auth
     ```

---

## 📋 檢查清單

### 獲取 JWT Secret
- [ ] 登入 Supabase Dashboard
- [ ] 進入 Settings → API
- [ ] 複製 JWT Secret

### 設定環境變數
- [ ] 進入 Edge Functions → twitter-auth → Settings
- [ ] 添加環境變數 `JWT_SECRET`
- [ ] 貼上 JWT Secret 值
- [ ] 儲存設定

### 測試
- [ ] 測試 X 登入功能
- [ ] 確認不再出現 "signature is invalid" 錯誤
- [ ] 確認登入流程正常運作

---

## 🎯 預期結果

設定完成後：
1. ✅ Edge Function 使用 Supabase 的 JWT Secret 簽名 `state`
2. ✅ Supabase 能夠驗證 `state` 的簽名
3. ✅ 不會出現 "signature is invalid" 錯誤
4. ✅ X 登入功能應該能夠正常工作

---

## 📚 相關文件

- `X_Twitter_state_簽名驗證失敗_解決方案.md` - 簽名驗證失敗解決方案
- `X_Twitter_state_JWT格式修復完成.md` - JWT 格式修復完成
- `X_Twitter_state_格式錯誤_解決方案.md` - state 格式錯誤解決方案

---

**下一步**：請按照上述步驟設定 `JWT_SECRET` 環境變數，然後重新測試 X 登入功能。
