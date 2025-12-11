# LINE Email 權限申請指南

> **適用於**：LINE Developers Console → Basic settings → OpenID Connect → Email address permission  
> **更新日期**：2025-01-29

---

## 📋 申請前準備

在申請 LINE Email 權限之前，請確認：

1. ✅ **隱私權政策已上線**
   - 隱私權政策 URL：`https://chaos-registry.vercel.app/privacy`
   - 隱私權政策中需明確說明收集 Email 的目的

2. ✅ **應用程式已實作 Email 收集說明**
   - 在登入頁面或隱私權政策中說明為何需要 Email
   - 說明 Email 的使用目的（例如：帳號驗證、重要通知等）

3. ✅ **已閱讀 LINE User Data Policy**
   - 確保應用程式符合 LINE 的資料使用政策

---

## 📝 申請步驟

### 步驟 1：進入 Email 權限申請頁面

1. **登入 LINE Developers Console**
   - 網址：https://developers.line.biz/console/
   - 選擇您的 Provider（例如：`ChaosRegistry`）

2. **進入 Channel 設定**
   - 選擇您的 LINE Login Channel（Channel ID: `2008600116`）
   - 進入 **Basic settings** → **OpenID Connect**
   - 找到 **「Email address permission」** 區塊
   - 點擊 **「Apply」** 或 **「Request」** 按鈕

### 步驟 2：填寫申請表單

#### 2.1 同意條款

**條款 1：Email 收集同意聲明**
```
☑ My app only collects a user's email address after asking for their consent 
   and explaining the purpose of collecting, and complies with all privacy laws 
   applicable to the locations where my app collects, stores, and processes personal data.
```

**說明**：
- ✅ 勾選此選項，表示您的應用程式會在取得用戶同意後才收集 Email
- ✅ 並說明收集 Email 的目的
- ✅ 符合所有適用的隱私法規

**條款 2：LINE User Data Policy 同意**
```
☑ I comply with LINE User Data Policy.
```

**說明**：
- ✅ 勾選此選項，表示您已閱讀並同意遵守 LINE User Data Policy
- ⚠️ **重要**：請先閱讀 [LINE User Data Policy](https://developers.line.biz/en/docs/line-login/policy/) 再勾選

#### 2.2 上傳截圖

**截圖要求**：
- **檔案大小**：不超過 3 MB
- **檔案格式**：PNG, JPG, JPEG, GIF, BMP
- **截圖內容**：必須顯示應用程式如何請求用戶同意並說明收集 Email 的目的

---

## 📸 截圖建議

### 方案 1：隱私權政策頁面截圖（推薦）✅

**截圖內容**：
1. 打開應用程式的隱私權政策頁面
2. 滾動到說明 Email 收集的部分
3. 截圖應包含：
   - 頁面標題（隱私權政策）
   - Email 收集說明（例如：「一、資料收集範圍」中的「使用者暱稱、電子郵件（如有提供）」）
   - 使用目的說明（例如：「二、資料使用目的」）

**截圖範例說明**：
```
截圖應顯示：
- 隱私權政策標題
- 「一、資料收集範圍」區塊
- 「使用者暱稱、電子郵件（如有提供）」項目
- 「二、資料使用目的」區塊
- 說明 Email 用於帳號驗證、重要通知等目的
```

**如何截圖**：
1. 在瀏覽器中打開：`https://chaos-registry.vercel.app/privacy`
2. 滾動到「一、資料收集範圍」和「二、資料使用目的」區塊
3. 使用瀏覽器截圖工具或系統截圖工具截取整個頁面
4. 確保截圖清晰，文字可讀

### 方案 2：登入頁面截圖（如果有的話）

**截圖內容**：
1. 打開應用程式的登入頁面
2. 顯示 LINE 登入按鈕
3. 如果有說明文字，應包含：
   - 說明使用 LINE 登入會收集 Email
   - 說明收集 Email 的目的

**注意**：如果登入頁面沒有明確說明 Email 收集，建議使用方案 1（隱私權政策頁面）

### 方案 3：LINE 授權頁面截圖（不推薦）

**說明**：
- LINE 授權頁面是 LINE 提供的，不是您的應用程式
- LINE 要求的是**您的應用程式**如何說明 Email 收集
- 因此不建議使用 LINE 授權頁面截圖

---

## ✅ 檢查清單

在上傳截圖前，請確認：

- [ ] 截圖清晰，文字可讀
- [ ] 截圖顯示應用程式如何請求用戶同意
- [ ] 截圖顯示收集 Email 的目的說明
- [ ] 截圖檔案大小不超過 3 MB
- [ ] 截圖格式為 PNG, JPG, JPEG, GIF, 或 BMP
- [ ] 兩個條款都已勾選
- [ ] 已閱讀 LINE User Data Policy

---

## 📄 隱私權政策建議內容

為了符合 LINE 的要求，建議在隱私權政策中明確說明：

### 建議在「一、資料收集範圍」中加入：

```markdown
### 1. 帳號資訊
- 第三方登入資訊（Google、Apple ID、LINE 等授權資料）
- 使用者暱稱、電子郵件（如有提供）
  - **LINE 登入**：當您使用 LINE 登入時，我們會請求您的 Email 地址（如果您的 LINE 帳號已驗證 Email）
  - **Email 使用目的**：用於帳號驗證、重要通知、密碼重設等服務相關功能
- 裝置識別碼（UUID）
```

### 建議在「二、資料使用目的」中加入：

```markdown
1. **提供與維護服務**：
   - 確保帳號登入、投票功能、代幣系統正常運作
   - **Email 用途**：帳號驗證、密碼重設、重要服務通知（如投票結果、代幣變動等）
```

---

## 🔍 審核流程

### 提交後

1. **審核時間**：通常需要 1-3 個工作天
2. **審核結果**：
   - ✅ **通過**：Email 權限將自動啟用
   - ❌ **拒絕**：LINE 會說明拒絕原因，您可以修改後重新申請

### 審核通過後

1. **Email 權限狀態**：從 **「Unapplied」** 變更為 **「Applied」** 或 **「Approved」**
2. **功能啟用**：應用程式可以取得 LINE 用戶的 Email 地址（如果用戶已驗證 Email）

---

## ⚠️ 重要提醒

### 1. Email 收集限制

- **用戶必須已驗證 Email**：LINE 只會返回已驗證 Email 的用戶地址
- **用戶可以選擇不分享**：即使申請通過，用戶仍可以選擇不分享 Email
- **建議設定**：在 Supabase 中勾選 **「Allow users without an email」**，讓沒有 Email 的用戶也能登入

### 2. 隱私法規遵循

- **GDPR**（歐盟）：需要明確說明收集目的，並取得用戶同意
- **個資法**（台灣）：需要告知收集目的，並取得用戶同意
- **其他地區**：請確認符合當地隱私法規

### 3. 用戶同意

- 即使申請通過，仍需要在應用程式中明確告知用戶
- 建議在隱私權政策中詳細說明 Email 的使用目的
- 用戶有權選擇不分享 Email

---

## 📞 問題排解

### 問題 1：截圖被拒絕

**可能原因**：
- 截圖沒有顯示 Email 收集說明
- 截圖不清晰或文字不可讀
- 截圖顯示的不是您的應用程式

**解決方案**：
1. 確認截圖顯示隱私權政策中關於 Email 的說明
2. 確保截圖清晰，文字可讀
3. 如果隱私權政策中沒有明確說明，請先更新隱私權政策

### 問題 2：審核被拒絕

**可能原因**：
- 隱私權政策中沒有明確說明 Email 收集目的
- 應用程式中沒有請求用戶同意的流程
- 不符合 LINE User Data Policy

**解決方案**：
1. 檢查 LINE 的拒絕原因說明
2. 更新隱私權政策，明確說明 Email 收集目的
3. 確保應用程式符合 LINE User Data Policy
4. 修改後重新申請

### 問題 3：審核時間過長

**解決方案**：
1. 通常需要 1-3 個工作天，請耐心等待
2. 如果超過 5 個工作天，可以聯繫 LINE 客服
3. 檢查 LINE Developers Console 中的通知訊息

---

## 🔗 相關文件

- [LINE User Data Policy](https://developers.line.biz/en/docs/line-login/policy/)
- [LINE 第三方登入完整設定指南](./LINE第三方登入完整設定指南.md)
- [隱私權政策頁面](./src/pages/PrivacyPage.tsx)

---

## ✅ 總結

**申請 Email 權限的關鍵步驟**：

1. ✅ **閱讀並同意兩個條款**
   - Email 收集同意聲明
   - LINE User Data Policy 同意

2. ✅ **準備截圖**
   - 顯示應用程式如何請求用戶同意
   - 顯示收集 Email 的目的說明
   - 建議使用隱私權政策頁面截圖

3. ✅ **提交申請**
   - 等待 LINE 審核（1-3 個工作天）

4. ✅ **審核通過後**
   - Email 權限將自動啟用
   - 應用程式可以取得 LINE 用戶的 Email 地址

**重要提醒**：
- 即使申請通過，用戶仍可以選擇不分享 Email
- 建議在 Supabase 中勾選 **「Allow users without an email」**
- 確保隱私權政策中明確說明 Email 的使用目的


