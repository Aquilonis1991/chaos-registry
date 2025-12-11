# Vercel 域名 DNS 設定步驟 - chaosregistry.com

## 📋 Vercel 要求的 DNS 記錄

根據 Vercel Dashboard 的提示，您需要設定以下 DNS 記錄：

```
Type: A
Name: @
Value: 216.198.79.1
```

---

## 🔧 設定步驟

### 步驟 1：登入域名註冊商

1. **登入**您的域名註冊商帳號（購買 `chaosregistry.com` 的服務商）
2. **找到域名管理**頁面
3. **選擇** `chaosregistry.com` 域名

### 步驟 2：找到 DNS 設定

在域名管理頁面中，找到以下其中一個選項：
- **DNS Management**（DNS 管理）
- **DNS Records**（DNS 記錄）
- **Advanced DNS**（進階 DNS）
- **Name Servers**（名稱伺服器）

### 步驟 3：設定 A Record

#### 3.1 添加 A Record（根域名）

1. **點擊** "Add Record"（添加記錄）或類似按鈕
2. **選擇記錄類型**：`A` 或 `A Record`
3. **填寫以下資訊**：
   - **Type（類型）**：`A`
   - **Name（名稱）**：`@` 或留空（表示根域名）
   - **Value（值）**：`216.198.79.1`
   - **TTL（生存時間）**：`3600` 或 `自動` 或 `1 hour`

4. **儲存**記錄

#### 3.2 添加 CNAME Record（www 子域名，可選但建議）

1. **點擊** "Add Record"
2. **選擇記錄類型**：`CNAME`
3. **填寫以下資訊**：
   - **Type（類型）**：`CNAME`
   - **Name（名稱）**：`www`
   - **Value（值）**：`cname.vercel-dns.com`
   - **TTL（生存時間）**：`3600` 或 `自動`

4. **儲存**記錄

---

## 📝 不同域名註冊商的設定方法

### Namecheap

1. **登入** Namecheap
2. **前往** Domain List
3. **點擊** Manage（管理）按鈕
4. **選擇** Advanced DNS 標籤
5. **在 Host Records 區塊中**：
   - 點擊 "Add New Record"
   - Type: `A Record`
   - Host: `@`
   - Value: `216.198.79.1`
   - TTL: `Automatic`
   - 點擊 ✓ 儲存

6. **（可選）添加 www CNAME**：
   - Type: `CNAME Record`
   - Host: `www`
   - Value: `cname.vercel-dns.com`
   - TTL: `Automatic`
   - 點擊 ✓ 儲存

### Cloudflare

1. **登入** Cloudflare
2. **選擇** `chaosregistry.com` 域名
3. **前往** DNS 標籤
4. **添加 A Record**：
   - Type: `A`
   - Name: `@`
   - IPv4 address: `216.198.79.1`
   - Proxy status: `DNS only`（灰色雲朵，不要開啟代理）
   - 點擊 Save

5. **（可選）添加 CNAME**：
   - Type: `CNAME`
   - Name: `www`
   - Target: `cname.vercel-dns.com`
   - Proxy status: `DNS only`
   - 點擊 Save

### GoDaddy

1. **登入** GoDaddy
2. **前往** My Products → Domains
3. **點擊** `chaosregistry.com` 的 DNS 按鈕
4. **在 Records 區塊中**：
   - 點擊 "Add"
   - Type: `A`
   - Name: `@`
   - Value: `216.198.79.1`
   - TTL: `1 Hour`
   - 點擊 Save

### Google Domains

1. **登入** Google Domains
2. **選擇** `chaosregistry.com`
3. **前往** DNS 標籤
4. **在 Custom resource records 區塊中**：
   - 點擊 "Add custom record"
   - Type: `A`
   - Name: `@`
   - Data: `216.198.79.1`
   - TTL: `3600`
   - 點擊 Save

---

## ⏳ 步驟 4：等待 DNS 傳播

### 4.1 DNS 傳播時間

- **通常**：24-48 小時
- **最快**：幾分鐘到幾小時
- **最慢**：最多 72 小時

### 4.2 檢查 DNS 是否生效

#### 方法 1：使用線上工具（推薦）

1. **前往**：https://dnschecker.org/
2. **輸入域名**：`chaosregistry.com`
3. **選擇記錄類型**：`A`
4. **點擊** Search
5. **檢查結果**：
   - ✅ 如果顯示 `216.198.79.1`，表示已生效
   - ⚠️ 如果顯示其他 IP 或錯誤，表示尚未生效

#### 方法 2：使用命令列

**Windows PowerShell**：
```powershell
nslookup chaosregistry.com
```

**應該顯示**：
```
Name:    chaosregistry.com
Address:  216.198.79.1
```

#### 方法 3：在 Vercel Dashboard 檢查

1. **前往** Vercel Dashboard
2. **選擇專案** → **Settings** → **Domains**
3. **查看域名狀態**：
   - ✅ **Valid Configuration**：設定正確，已連接
   - ⚠️ **Pending**：等待 DNS 傳播
   - ❌ **Invalid Configuration**：設定有誤，需要檢查

---

## ✅ 步驟 5：確認連接成功

### 5.1 在 Vercel 中確認

1. **前往**專案的 **Settings** → **Domains**
2. **確認狀態**：
   - 應該顯示 **Valid Configuration** ✅
   - 應該顯示 **SSL Certificate** 已發行 ✅
   - 應該顯示綠色的勾選標記 ✅

### 5.2 測試網站訪問

1. **訪問**您的域名：
   ```
   https://chaosregistry.com
   ```

2. **確認**：
   - ✅ 網站可以正常載入
   - ✅ 顯示 HTTPS（有鎖頭圖示）
   - ✅ 內容正確顯示（應該看到 Landing Page）

---

## 🔄 步驟 6：更新專案設定

### 6.1 更新環境變數（如果需要）

在 Vercel Dashboard：
1. **前往**專案的 **Settings** → **Environment Variables**
2. **檢查**是否有 `VITE_PUBLIC_SITE_URL`
3. **如果有**，更新為：
   ```
   https://chaosregistry.com
   ```

### 6.2 更新程式碼中的 URL

#### 更新 AuthPage.tsx

```typescript
const defaultSiteUrl = "https://chaosregistry.com"; // 從 chaos-registry.vercel.app 改為新域名
```

#### 更新 Edge Function 環境變數

在 Supabase Dashboard：
1. **前往** **Edge Functions** → **Settings**
2. **找到** `FRONTEND_URL` 環境變數
3. **更新為**：
   ```
   https://chaosregistry.com
   ```

---

## ⚠️ 常見問題

### Q1：設定後多久會生效？

**A**：通常 24-48 小時，但有時幾分鐘內就會生效。可以使用 DNS 檢查工具確認。

### Q2：為什麼顯示 "Invalid Configuration"？

**A**：可能原因：
- DNS 記錄尚未設定
- DNS 記錄設定錯誤
- DNS 尚未傳播完成

**解決方法**：
1. 確認 DNS 記錄已正確設定
2. 使用 DNS 檢查工具確認記錄是否生效
3. 等待更長時間（最多 72 小時）

### Q3：需要設定 www 子域名嗎？

**A**：建議設定，這樣 `www.chaosregistry.com` 和 `chaosregistry.com` 都可以訪問。

### Q4：SSL 憑證會自動發行嗎？

**A**：是的，Vercel 會自動為您的自訂域名發行免費的 SSL 憑證（Let's Encrypt），通常在 DNS 生效後幾分鐘內完成。

### Q5：設定 A Record 後，舊的記錄需要刪除嗎？

**A**：如果之前有設定其他 A Record 或 CNAME Record 指向其他地方，建議刪除，避免衝突。

---

## 📋 設定檢查清單

### DNS 設定
- [ ] 已在域名註冊商設定 A Record
  - [ ] Type: `A`
  - [ ] Name: `@` 或留空
  - [ ] Value: `216.198.79.1`
- [ ] （可選）已設定 CNAME Record for www
  - [ ] Type: `CNAME`
  - [ ] Name: `www`
  - [ ] Value: `cname.vercel-dns.com`

### DNS 傳播確認
- [ ] 使用 DNS 檢查工具確認記錄已生效
- [ ] 使用 nslookup 確認 IP 正確

### Vercel 確認
- [ ] Vercel Dashboard 顯示 Valid Configuration
- [ ] SSL 憑證已發行
- [ ] 網站可以通過新域名訪問

### 專案更新
- [ ] 已更新環境變數（如果需要）
- [ ] 已更新程式碼中的 URL（如果需要）
- [ ] 已更新 Edge Function 環境變數（如果需要）

---

## 🎯 快速設定摘要

### 需要設定的 DNS 記錄

**必須設定**：
```
Type: A
Name: @
Value: 216.198.79.1
```

**建議設定**（www 子域名）：
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 設定位置

在您的域名註冊商（購買 `chaosregistry.com` 的服務商）的 DNS 管理頁面中設定。

### 等待時間

- **DNS 傳播**：24-48 小時（有時更快）
- **SSL 憑證**：DNS 生效後幾分鐘內自動發行

### 確認方法

1. **DNS 檢查**：https://dnschecker.org/
2. **Vercel Dashboard**：Settings → Domains
3. **實際訪問**：https://chaosregistry.com

---

## 📞 需要協助？

如果設定後仍然顯示 "Invalid Configuration"：

1. **檢查 DNS 記錄**：
   - 確認記錄類型正確（A Record）
   - 確認 Name 正確（@ 或留空）
   - 確認 Value 正確（216.198.79.1）

2. **等待更長時間**：
   - DNS 傳播可能需要 48-72 小時
   - 使用 DNS 檢查工具確認是否已傳播

3. **聯繫支援**：
   - **Vercel 支援**：在 Dashboard 中提交支援請求
   - **域名註冊商支援**：聯繫您的域名註冊商客服

---

## ✅ 設定完成後

當 Vercel 顯示 **Valid Configuration** 後：

1. **更新 META 商家驗證**：
   - 網站 URL：`https://chaosregistry.com`
   - 重新提交驗證

2. **更新其他服務**（如果需要）：
   - LINE Callback URL
   - Supabase Redirect URLs
   - 其他 OAuth 設定

3. **測試網站**：
   - 確認 `https://chaosregistry.com` 可以正常訪問
   - 確認 `https://www.chaosregistry.com` 可以正常訪問（如果設定了）


