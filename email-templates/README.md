# ChaosRegistry 郵件模板配置指南

本目錄包含 ChaosRegistry 的自訂郵件模板，用於 Supabase 認證系統。

## 📧 模板文件

- `verification-email-template.html` - 註冊驗證郵件 HTML 模板
- `verification-email-subject.txt` - 註冊驗證郵件標題

## 🚀 配置步驟

### 1. 登入 Supabase Dashboard

1. 前往 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇您的項目（ChaosRegistry）
3. 進入 **Authentication** → **Email Templates**

### 2. 配置註冊驗證郵件

1. 在 Email Templates 頁面，找到 **"Confirm signup"** 模板
2. 點擊 **"Edit"** 或 **"Customize"** 按鈕

### 3. 設定郵件標題

在 **Subject** 欄位中，輸入或貼上以下內容：

```
歡迎加入 ChaosRegistry！請驗證您的郵件地址
```

或使用 `verification-email-subject.txt` 文件中的內容。

### 4. 設定郵件內容

在 **Body** 欄位中：

1. 選擇 **HTML** 模式（如果有的話）
2. 複製 `verification-email-template.html` 文件的全部內容
3. 貼上到 Body 欄位中

### 5. 重要變數說明

模板中使用以下 Supabase 變數，**請勿刪除或修改**：

- `{{ .ConfirmationURL }}` - 驗證連結（**必須保留**）
- `{{ .Email }}` - 用戶郵件地址（可選）
- `{{ .Token }}` - 驗證令牌（可選）
- `{{ .SiteURL }}` - 網站 URL（可選）
- `{{ .RedirectTo }}` - 重定向 URL（可選）

### 6. 儲存並測試

1. 點擊 **"Save"** 儲存模板
2. 使用測試帳號註冊，確認郵件正常發送
3. 檢查郵件在不同郵件客戶端（Gmail、Outlook 等）的顯示效果

## 🎨 模板特色

- ✅ 響應式設計，支援手機和桌面
- ✅ 現代化漸層配色（紫色主題）
- ✅ 清晰的視覺層次
- ✅ 包含備用連結（按鈕無法點擊時）
- ✅ 重要提醒區塊（過期時間、安全提示）
- ✅ 繁體中文內容

## 📝 自訂建議

### 修改顏色主題

在 HTML 模板中搜尋以下顏色代碼並替換：

- 主色調：`#667eea`（藍紫色）
- 漸層色：`#764ba2`（深紫色）
- 背景色：`#f5f5f5`（淺灰）
- 文字色：`#1a1a1a`（深灰）

### 修改品牌名稱

搜尋並替換所有 `ChaosRegistry` 為您的品牌名稱。

### 修改過期時間

在「重要提醒」區塊中，修改 `24 小時` 為實際的過期時間。

## 🔍 測試檢查清單

配置完成後，請確認：

- [ ] 郵件標題正確顯示
- [ ] 驗證按鈕可以點擊
- [ ] 驗證連結正確導向 `/auth/verify-redirect`
- [ ] 備用連結可以複製和使用
- [ ] 在手機和桌面郵件客戶端顯示正常
- [ ] 繁體中文文字正確顯示
- [ ] 所有變數（如 `{{ .ConfirmationURL }}`）正確替換

## 🐛 常見問題

### Q: 郵件沒有收到驗證連結？

A: 確認模板中包含了 `{{ .ConfirmationURL }}` 變數，且沒有被刪除或修改。

### Q: 郵件顯示亂碼？

A: 確認 HTML 模板開頭有 `<meta charset="UTF-8">`，且 Supabase 設定為 UTF-8 編碼。

### Q: 按鈕樣式顯示異常？

A: 某些郵件客戶端（如 Outlook）對 CSS 支援有限，建議使用內聯樣式（inline styles）。

### Q: 如何測試郵件模板？

A: 
1. 使用測試帳號註冊
2. 檢查收件箱（包括垃圾郵件資料夾）
3. 點擊驗證連結確認功能正常

## 📚 相關資源

- [Supabase Email Templates 文檔](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Auth 配置](https://supabase.com/docs/guides/auth)

## 🔄 更新記錄

- **2025-11-27**: 創建初始模板
  - 響應式設計
  - 繁體中文內容
  - 品牌化樣式


