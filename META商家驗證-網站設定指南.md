# META 商家驗證 - 網站設定指南

## 📋 您的網站資訊

根據專案設定，您的網站 URL 是：

**🌐 網站 URL**：`https://chaos-registry.vercel.app`

---

## 🔍 META 商家驗證 - 網站欄位填寫

### 步驟 1：填寫網站 URL

在 META 商家驗證的「新增商家詳細資料」頁面中：

1. **網站欄位**：填入
   ```
   https://chaos-registry.vercel.app
   ```

2. **重要注意事項**：
   - ✅ 必須包含 `https://` 前綴
   - ✅ 不要包含結尾的斜線 `/`
   - ✅ 確保網站可以正常訪問

---

## ✅ 驗證網站是否可訪問

### 檢查步驟：

1. **打開瀏覽器**
2. **訪問**：https://chaos-registry.vercel.app
3. **確認**：
   - ✅ 網站可以正常載入
   - ✅ 沒有錯誤訊息
   - ✅ 頁面內容正常顯示

### 如果網站無法訪問：

**可能原因**：
- Vercel 部署未完成
- 域名設定有問題
- 網站已下線

**解決方法**：
1. 檢查 Vercel 部署狀態
2. 確認域名設定正確
3. 重新部署網站

---

## 📝 其他商家詳細資料建議

### 商家名稱
建議填寫：`ChaosRegistry` 或 `VoteChaos`

### 商家類型
根據您的應用性質，可以選擇：
- **應用程式開發**
- **軟體服務**
- **數位服務**

### 商家地址
- 如果沒有實體地址，可以填寫：
  - 註冊地址（如果有公司）
  - 或使用服務地址

### 聯絡電話
- 填寫有效的聯絡電話
- 建議使用可以接收驗證碼的電話

### 電子郵件
- 填寫有效的電子郵件
- 建議使用與 Facebook 帳號關聯的郵件

---

## 🔐 網站驗證方法

META 可能會要求驗證網站所有權，常見方法：

### 方法 1：Meta Pixel（推薦）

1. **在 META Business Manager 中**：
   - 前往「事件管理工具」
   - 創建新的 Pixel
   - 複製 Pixel ID

2. **在網站中安裝 Pixel**：
   - 在網站 HTML 的 `<head>` 標籤中添加 Meta Pixel 代碼
   - 或使用 Google Tag Manager 安裝

3. **驗證安裝**：
   - 使用 Meta Pixel Helper 擴充功能檢查
   - 確認 Pixel 正常運作

### 方法 2：HTML Meta Tag

1. **在 META Business Manager 中**：
   - 取得驗證 Meta Tag
   - 複製驗證代碼

2. **在網站中添加**：
   - 在網站 HTML 的 `<head>` 標籤中添加驗證 Meta Tag

3. **驗證**：
   - 返回 META Business Manager
   - 點擊「驗證」

### 方法 3：上傳 HTML 檔案

1. **下載驗證檔案**：
   - 從 META Business Manager 下載驗證 HTML 檔案

2. **上傳到網站根目錄**：
   - 將檔案上傳到 `https://chaos-registry.vercel.app/` 根目錄
   - 確保可以通過 `https://chaos-registry.vercel.app/驗證檔案名.html` 訪問

3. **驗證**：
   - 返回 META Business Manager
   - 點擊「驗證」

---

## 🛠️ 如何在 Vercel 網站中添加驗證代碼

### 選項 1：在 HTML 中添加（如果使用靜態 HTML）

1. **找到網站的 HTML 檔案**（通常在 `index.html`）
2. **在 `<head>` 標籤中添加驗證代碼**
3. **重新部署到 Vercel**

### 選項 2：使用環境變數（推薦）

1. **在 Vercel Dashboard 中**：
   - 前往專案設定
   - 找到「Environment Variables」
   - 添加驗證代碼作為環境變數

2. **在程式碼中使用**：
   ```typescript
   // 在 React 組件中添加
   useEffect(() => {
     const metaTag = document.createElement('meta');
     metaTag.name = 'facebook-domain-verification';
     metaTag.content = process.env.VITE_META_VERIFICATION_CODE;
     document.head.appendChild(metaTag);
   }, []);
   ```

### 選項 3：在 `index.html` 中直接添加

如果您的專案有 `index.html` 檔案：

1. **打開** `index.html`（通常在 `public/` 或根目錄）
2. **在 `<head>` 標籤中添加**：
   ```html
   <meta name="facebook-domain-verification" content="您的驗證代碼" />
   ```
3. **重新部署**

---

## 📋 檢查清單

在提交 META 商家驗證前，請確認：

- [ ] 網站 URL 正確：`https://chaos-registry.vercel.app`
- [ ] 網站可以正常訪問
- [ ] 網站沒有錯誤訊息
- [ ] 已準備好驗證方法（Meta Pixel、Meta Tag 或 HTML 檔案）
- [ ] 商家名稱已確定
- [ ] 聯絡資訊已準備好
- [ ] 商家地址已準備好（如果需要）

---

## ⚠️ 常見問題

### Q1：網站顯示「找不到頁面」怎麼辦？

**A**：檢查 Vercel 部署狀態，確認網站已正確部署。

### Q2：META 說找不到驗證代碼怎麼辦？

**A**：
1. 確認驗證代碼已正確添加到網站
2. 清除瀏覽器快取後重新檢查
3. 使用 META 的「重新驗證」功能

### Q3：可以使用其他域名嗎？

**A**：可以，但需要：
1. 確保新域名已正確設定
2. 更新專案中的網站 URL 設定
3. 重新部署網站

### Q4：驗證需要多長時間？

**A**：通常 1-3 個工作天，META 會審核您的商家資料。

---

## 🎯 快速填寫指南

### 在 META 商家驗證頁面中：

1. **網站**：
   ```
   https://chaos-registry.vercel.app
   ```

2. **商家名稱**：
   ```
   ChaosRegistry
   ```
   或
   ```
   VoteChaos
   ```

3. **商家類型**：
   ```
   應用程式開發
   ```
   或
   ```
   軟體服務
   ```

4. **其他欄位**：根據實際情況填寫

---

## 📞 需要協助？

如果遇到問題：

1. **檢查網站狀態**：確認 `https://chaos-registry.vercel.app` 可以訪問
2. **查看 META 幫助中心**：https://www.facebook.com/business/help
3. **聯繫 META 支援**：在 Business Manager 中提交支援請求

---

## ✅ 總結

**您的網站 URL**：`https://chaos-registry.vercel.app`

**填寫建議**：
- 直接使用上述 URL
- 確保網站可以正常訪問
- 準備好驗證方法（Meta Pixel 或 Meta Tag）

**驗證流程**：
1. 填寫網站 URL
2. 完成其他商家詳細資料
3. 選擇驗證方法並完成驗證
4. 提交審核
5. 等待 META 審核結果（1-3 個工作天）



