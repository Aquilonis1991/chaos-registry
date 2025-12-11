# Vercel 自訂域名設定指南

## 📋 前置準備

### 需要準備的資訊
- ✅ Vercel 帳號（已有）
- ✅ 專案：`chaos-registry`（已有）
- ⚠️ 自訂域名（需要購買，如 `votechaos.com`）

---

## 🛒 步驟 1：購買域名（如果還沒有）

### 推薦的域名註冊商

#### 選項 1：Namecheap（推薦）⭐⭐⭐⭐⭐
- **網址**：https://www.namecheap.com/
- **優點**：價格合理、介面友善、免費 WHOIS 保護
- **價格**：約 $10-15 USD/年

#### 選項 2：Cloudflare（推薦）⭐⭐⭐⭐⭐
- **網址**：https://www.cloudflare.com/products/registrar/
- **優點**：價格透明、免費隱私保護、整合 DNS
- **價格**：約 $8-12 USD/年

#### 選項 3：GoDaddy
- **網址**：https://www.godaddy.com/
- **優點**：知名度高、客服完善
- **價格**：約 $12-20 USD/年

### 建議的域名
- `votechaos.com`
- `chaosregistry.com`
- `votechaos.app`
- `chaosregistry.app`

### 購買步驟（以 Namecheap 為例）

1. **前往 Namecheap**
   - 訪問 https://www.namecheap.com/
   - 搜尋想要的域名（如 `votechaos.com`）

2. **選擇域名**
   - 選擇可用的域名
   - 選擇註冊年限（建議 1-2 年）

3. **完成購買**
   - 填寫註冊資訊
   - 完成付款

4. **確認購買**
   - 等待域名啟用（通常幾分鐘到幾小時）

---

## 🔧 步驟 2：在 Vercel 中添加自訂域名

### 2.1 登入 Vercel Dashboard

1. **前往**：https://vercel.com/dashboard
2. **登入**您的 Vercel 帳號
3. **選擇專案**：`chaos-registry`

### 2.2 添加域名

1. **在專案頁面中**：
   - 點擊 **Settings**（設定）
   - 在左側選單中找到 **Domains**（域名）

2. **添加域名**：
   - 點擊 **Add Domain**（添加域名）
   - 輸入您的域名（例如：`votechaos.com`）
   - 點擊 **Add**（添加）

3. **選擇域名類型**：
   - **Apex Domain**（根域名）：`votechaos.com`
   - **Subdomain**（子域名）：`www.votechaos.com`
   - **建議**：同時添加兩者

### 2.3 取得 DNS 設定資訊

Vercel 會顯示需要設定的 DNS 記錄，例如：

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

**重要**：請記下這些資訊，下一步會用到。

---

## 🌐 步驟 3：在域名註冊商設定 DNS

### 3.1 登入域名註冊商

1. **登入**您的域名註冊商帳號（Namecheap、Cloudflare 等）
2. **找到域名管理**頁面
3. **選擇**您購買的域名

### 3.2 設定 DNS 記錄

#### 方法 A：使用 Vercel 的 Nameservers（推薦）⭐⭐⭐⭐⭐

**優點**：簡單、自動管理、免費 SSL

1. **在 Vercel 中**：
   - 前往專案的 **Settings** → **Domains**
   - 找到您的域名
   - 點擊 **Configure**（設定）
   - 選擇 **Nameservers**（名稱伺服器）

2. **複製 Nameservers**：
   Vercel 會提供類似這樣的 Nameservers：
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```

3. **在域名註冊商中設定**：
   - 找到 **Nameservers** 或 **DNS** 設定
   - 將預設的 Nameservers 改為 Vercel 提供的
   - 儲存變更

4. **等待生效**：
   - 通常需要 24-48 小時
   - 有時幾分鐘內就會生效

#### 方法 B：使用 A Record 和 CNAME（如果無法更改 Nameservers）

1. **在域名註冊商的 DNS 設定中**：

   **添加 A Record**（根域名）：
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   TTL: 3600（或自動）
   ```

   **添加 CNAME Record**（www 子域名）：
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   TTL: 3600（或自動）
   ```

2. **儲存設定**

---

## ⏳ 步驟 4：等待 DNS 傳播

### 4.1 DNS 傳播時間

- **通常**：24-48 小時
- **最快**：幾分鐘到幾小時
- **最慢**：最多 72 小時

### 4.2 檢查 DNS 是否生效

#### 方法 1：使用線上工具

1. **前往**：https://dnschecker.org/
2. **輸入**您的域名（如 `votechaos.com`）
3. **選擇記錄類型**：A 或 CNAME
4. **檢查**是否已更新

#### 方法 2：使用命令列

```bash
# Windows PowerShell
nslookup votechaos.com

# 或使用 dig（如果已安裝）
dig votechaos.com
```

#### 方法 3：在 Vercel Dashboard 檢查

1. **前往**專案的 **Settings** → **Domains**
2. **查看域名狀態**：
   - ✅ **Valid Configuration**：設定正確
   - ⚠️ **Pending**：等待 DNS 傳播
   - ❌ **Invalid Configuration**：設定有誤

---

## ✅ 步驟 5：確認域名已連接

### 5.1 在 Vercel 中確認

1. **前往**專案的 **Settings** → **Domains**
2. **確認狀態**：
   - 應該顯示 **Valid Configuration** ✅
   - 應該顯示 **SSL Certificate** 已發行 ✅

### 5.2 測試網站訪問

1. **訪問**您的自訂域名：
   ```
   https://votechaos.com
   ```
   或
   ```
   https://www.votechaos.com
   ```

2. **確認**：
   - ✅ 網站可以正常載入
   - ✅ 顯示 HTTPS（有鎖頭圖示）
   - ✅ 內容正確顯示

---

## 🔄 步驟 6：更新專案設定

### 6.1 更新環境變數（如果需要）

如果專案中有使用環境變數儲存網站 URL：

1. **在 Vercel Dashboard 中**：
   - 前往專案的 **Settings** → **Environment Variables**
   - 找到 `VITE_PUBLIC_SITE_URL`（如果有）
   - 更新為新的域名：
     ```
     https://votechaos.com
     ```

### 6.2 更新程式碼中的 URL（如果需要）

檢查以下檔案是否需要更新：

1. **`src/pages/AuthPage.tsx`**：
   ```typescript
   const defaultSiteUrl = "https://votechaos.com"; // 更新為新域名
   ```

2. **`supabase/functions/line-auth/index.ts`**：
   ```typescript
   const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://votechaos.com';
   ```

3. **其他可能使用 URL 的地方**

### 6.3 更新 Edge Function 環境變數

1. **在 Supabase Dashboard 中**：
   - 前往 **Edge Functions** → **Settings**
   - 找到 `FRONTEND_URL` 環境變數
   - 更新為新域名：
     ```
     https://votechaos.com
     ```

---

## 📋 完整設定檢查清單

### 購買域名
- [ ] 已購買域名
- [ ] 域名已啟用

### Vercel 設定
- [ ] 已在 Vercel 添加域名
- [ ] 已取得 DNS 設定資訊或 Nameservers

### DNS 設定
- [ ] 已在域名註冊商設定 Nameservers（方法 A）
- [ ] 或已設定 A Record 和 CNAME（方法 B）
- [ ] DNS 已生效（檢查工具確認）

### 確認連接
- [ ] Vercel 顯示 Valid Configuration
- [ ] SSL 憑證已發行
- [ ] 網站可以通過新域名訪問
- [ ] HTTPS 正常運作

### 更新設定
- [ ] 已更新環境變數（如果需要）
- [ ] 已更新程式碼中的 URL（如果需要）
- [ ] 已更新 Edge Function 環境變數（如果需要）

---

## 🎯 設定完成後

### 1. 測試網站

訪問以下 URL，確認都可以正常訪問：
- `https://votechaos.com`（根域名）
- `https://www.votechaos.com`（www 子域名）

### 2. 更新 META 商家驗證

在 META Business Manager 中：
- **網站 URL**：改為新的自訂域名
  ```
  https://votechaos.com
  ```
- **重新提交驗證**

### 3. 更新其他服務

如果有其他服務使用舊的 Vercel URL，記得更新：
- LINE Developers Console（Callback URL）
- Supabase（Redirect URLs）
- 其他 OAuth 設定

---

## ⚠️ 常見問題

### Q1：DNS 設定後多久生效？

**A**：通常 24-48 小時，有時幾分鐘內就會生效。可以使用 DNS 檢查工具確認。

### Q2：可以同時使用 Vercel 子域名和自訂域名嗎？

**A**：可以！兩個都可以正常訪問，但建議主要使用自訂域名。

### Q3：SSL 憑證會自動發行嗎？

**A**：是的，Vercel 會自動為您的自訂域名發行免費的 SSL 憑證（Let's Encrypt）。

### Q4：需要設定 www 子域名嗎？

**A**：建議設定，這樣 `www.votechaos.com` 和 `votechaos.com` 都可以訪問。

### Q5：設定後舊的 Vercel URL 還能用嗎？

**A**：可以，但建議主要使用自訂域名。

---

## 📝 設定範例

### 域名註冊商：Namecheap

1. **登入 Namecheap**
2. **前往** Domain List
3. **點擊** Manage（管理）
4. **找到** Nameservers
5. **選擇** Custom DNS
6. **輸入** Vercel 提供的 Nameservers：
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```
7. **儲存**

### 域名註冊商：Cloudflare

1. **登入 Cloudflare**
2. **選擇**您的域名
3. **前往** DNS 設定
4. **如果使用 Cloudflare 的 Nameservers**：
   - 添加 A Record：`@` → `76.76.21.21`
   - 添加 CNAME：`www` → `cname.vercel-dns.com`
5. **如果使用 Vercel 的 Nameservers**：
   - 更改 Nameservers 為 Vercel 提供的

---

## 🎯 總結

### 設定流程

1. **購買域名**（如果還沒有）
2. **在 Vercel 添加域名**
3. **設定 DNS**（使用 Nameservers 或 A/CNAME Records）
4. **等待 DNS 傳播**（24-48 小時）
5. **確認連接**（Vercel Dashboard 和實際訪問）
6. **更新專案設定**（環境變數、程式碼）
7. **更新 META 驗證**（使用新域名）

### 預估時間

- **購買域名**：10-30 分鐘
- **Vercel 設定**：5-10 分鐘
- **DNS 設定**：5-10 分鐘
- **DNS 傳播**：24-48 小時（有時更快）
- **總計**：約 1-2 天（主要等待 DNS 傳播）

### 費用

- **域名**：約 $10-15 USD/年
- **Vercel**：免費（Hobby 方案）
- **SSL 憑證**：免費（Vercel 自動提供）

---

## 📞 需要協助？

如果遇到問題：

1. **Vercel 文檔**：https://vercel.com/docs/concepts/projects/domains
2. **Vercel 支援**：在 Dashboard 中提交支援請求
3. **域名註冊商支援**：聯繫您的域名註冊商客服


