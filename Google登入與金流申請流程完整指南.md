# Google 登入與金流申請流程完整指南

## 📋 目錄

1. [Google 第三方登入申請](#google-第三方登入申請)
2. [Google Play 內購申請](#google-play-內購申請)
3. [App Store 內購申請](#app-store-內購申請)
4. [第三方支付方案（Stripe/PayPal）](#第三方支付方案)

---

## 🔐 Google 第三方登入申請

### 前置準備

- Google 帳號
- Supabase 專案（已建立）
- 應用程式網域（例如：`chaos-registry.vercel.app`）

### 步驟 1：Google Cloud Console 設定

#### 1.1 建立或選擇專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊頂部「選取專案」>「新增專案」
3. 輸入專案名稱：`ChaosRegistry`
4. 點擊「建立」

#### 1.2 設定 OAuth 同意畫面

1. 導航到「API 和服務」>「OAuth 同意畫面」
2. 選擇「外部」（一般應用程式）
3. 點擊「建立」
4. 填寫資訊：
   - **應用程式名稱**：`ChaosRegistry`
   - **使用者支援電子郵件**：您的電子郵件
   - **應用程式標誌**：上傳 120x120px 圖示（可選）
   - **應用程式首頁連結**：`https://chaos-registry.vercel.app`
   - **隱私權政策連結**：`https://chaos-registry.vercel.app/privacy`
   - **服務條款連結**：`https://chaos-registry.vercel.app/terms`
   - **已授權的網域**：`chaos-registry.vercel.app`
5. 點擊「儲存並繼續」
6. 在「範圍」頁面：預設範圍已足夠，點擊「儲存並繼續」
7. 在「測試使用者」頁面：添加測試使用者（可選）
8. 點擊「返回資訊主頁」

#### 1.3 建立 OAuth 2.0 憑證

1. 導航到「API 和服務」>「憑證」
2. 點擊「建立憑證」>「OAuth 用戶端 ID」
3. 選擇「網頁應用程式」
4. 填寫資訊：
   - **名稱**：`ChaosRegistry Web Client`
   - **已授權的 JavaScript 來源**：
     - `https://epyykzxxglkjombvozhr.supabase.co`
     - `https://chaos-registry.vercel.app`
   - **已授權的重新導向 URI**：
     - `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
5. 點擊「建立」
6. **立即複製並保存**：
   - **用戶端 ID**：`123456789-xxxxx.apps.googleusercontent.com`
   - **用戶端密鑰**：`GOCSPX-xxxxx`（只顯示一次！）

### 步驟 2：Supabase Dashboard 設定

1. 前往 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`epyykzxxglkjombvozhr`
3. 導航到「Authentication」>「Providers」
4. 找到「Google」，點擊「Configure」
5. 填入：
   - **Client ID**：貼上從 Google Cloud Console 複製的用戶端 ID
   - **Client Secret**：貼上從 Google Cloud Console 複製的用戶端密鑰
6. 點擊「Save」

### 步驟 3：驗證 URL 設定

1. 在 Supabase Dashboard，導航到「Authentication」>「URL Configuration」
2. 確認「Redirect URLs」包含：
   - `https://chaos-registry.vercel.app/**`
   - `votechaos://auth/callback`（App 版）

### ✅ 完成檢查清單

- [ ] Google Cloud Console 專案已建立
- [ ] OAuth 同意畫面已設定
- [ ] OAuth 2.0 憑證已建立
- [ ] Client ID 和 Client Secret 已複製
- [ ] Supabase Dashboard 中已啟用 Google Provider
- [ ] URL Configuration 已設定

---

## 💰 Google Play 內購申請

### 前置準備

- Google Play Console 開發者帳號（一次性費用：$25 USD）
- 已發布的 Android App（或至少是測試版本）
- 銀行帳戶資訊（用於收款）

### 步驟 1：建立 Google Play Console 帳號

1. 前往 [Google Play Console](https://play.google.com/console/)
2. 使用 Google 帳號登入
3. 支付一次性註冊費：$25 USD
4. 填寫開發者資訊：
   - 開發者名稱
   - 聯絡資訊
   - 銀行帳戶資訊（用於收款）

### 步驟 2：建立應用程式

1. 在 Google Play Console，點擊「建立應用程式」
2. 填寫應用程式資訊：
   - **應用程式名稱**：`ChaosRegistry`
   - **預設語言**：繁體中文
   - **應用程式或遊戲**：選擇「應用程式」
   - **免費或付費**：選擇「免費」
3. 點擊「建立」

### 步驟 3：設定應用程式內產品

1. 在應用程式主頁，導航到「營利」>「產品」>「應用程式內產品」
2. 點擊「建立產品」
3. 選擇「管理式產品」
4. 為每個代幣方案建立產品：

#### 產品 1：小額代幣包
- **產品 ID**：`token_pack_small`（必須唯一）
- **名稱**：`小額代幣包`
- **描述**：`獲得 100 代幣 + 10 贈送代幣`
- **價格**：設定價格（例如：NT$ 30）
- **狀態**：啟用

#### 產品 2：中額代幣包
- **產品 ID**：`token_pack_medium`
- **名稱**：`中額代幣包`
- **描述**：`獲得 500 代幣 + 50 贈送代幣`
- **價格**：NT$ 150
- **狀態**：啟用

#### 產品 3：大額代幣包
- **產品 ID**：`token_pack_large`
- **名稱**：`大額代幣包`
- **描述**：`獲得 1000 代幣 + 100 贈送代幣`
- **價格**：NT$ 300
- **狀態**：啟用

### 步驟 4：在 Android App 中整合 Google Play Billing

#### 4.1 安裝依賴

在 `package.json` 中添加：

```json
{
  "dependencies": {
    "@capacitor-community/in-app-purchase": "^1.0.0"
  }
}
```

執行：
```bash
npm install
npx cap sync android
```

#### 4.2 設定 Android App

1. 在 `android/app/build.gradle` 中確認：
   ```gradle
   dependencies {
       implementation 'com.android.billingclient:billing:6.0.0'
   }
   ```

2. 在 `AndroidManifest.xml` 中添加權限（通常不需要額外權限）

#### 4.3 實作購買流程

在 `src/hooks/usePurchase.tsx` 中：

```typescript
import { InAppPurchase } from '@capacitor-community/in-app-purchase';

export const usePurchase = () => {
  const purchaseTokenPack = async (productId: string) => {
    try {
      // 初始化購買
      await InAppPurchase.initialize();
      
      // 開始購買流程
      const result = await InAppPurchase.purchase({
        productId: productId,
        productType: 'managed'
      });
      
      // 驗證購買（應該在後端驗證）
      if (result.success) {
        // 呼叫後端 API 驗證並發放代幣
        await verifyPurchase(result.purchaseToken);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      throw error;
    }
  };
  
  return { purchaseTokenPack };
};
```

### 步驟 5：後端驗證購買

在 Supabase Edge Function 中驗證 Google Play 購買：

```typescript
// supabase/functions/verify-google-play-purchase/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { purchaseToken, productId, userId } = await req.json();
  
  // 使用 Google Play Developer API 驗證購買
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );
  
  const purchaseData = await response.json();
  
  if (purchaseData.purchaseState === 0) { // 0 = 已購買
    // 發放代幣
    await supabase.rpc('add_tokens', {
      user_id: userId,
      token_amount: getTokenAmount(productId)
    });
    
    return new Response(JSON.stringify({ success: true }));
  }
  
  return new Response(JSON.stringify({ error: 'Invalid purchase' }), { status: 400 });
});
```

### ✅ Google Play 內購檢查清單

- [ ] Google Play Console 開發者帳號已建立（$25 USD）
- [ ] 應用程式已建立
- [ ] 應用程式內產品已建立（至少 3 個代幣包）
- [ ] Android App 中已整合 Google Play Billing
- [ ] 後端驗證邏輯已實作
- [ ] 測試購買流程成功

---

## 🍎 App Store 內購申請

### 前置準備

- Apple Developer Program 會員資格（每年 $99 USD）
- 已建立的 App ID
- 已配置的 App Store Connect 應用程式

### 步驟 1：建立 Apple Developer 帳號

1. 前往 [Apple Developer](https://developer.apple.com/)
2. 登入您的 Apple ID
3. 註冊 Apple Developer Program（每年 $99 USD）
4. 等待審核（通常 1-2 天）

### 步驟 2：在 App Store Connect 建立應用程式

1. 前往 [App Store Connect](https://appstoreconnect.apple.com/)
2. 點擊「我的 App」>「+」
3. 選擇「新 App」
4. 填寫資訊：
   - **平台**：iOS
   - **名稱**：`ChaosRegistry`
   - **主要語言**：繁體中文
   - **套件組合 ID**：選擇您的 App ID（例如：`com.votechaos.app`）
   - **SKU**：`chaos-registry-ios`（唯一識別碼）
5. 點擊「建立」

### 步驟 3：建立應用程式內購買項目

1. 在應用程式頁面，導航到「功能」>「App 內購買項目」
2. 點擊「+」>「建立」
3. 選擇「消耗性項目」（Consumable）
4. 為每個代幣方案建立產品：

#### 產品 1：小額代幣包
- **參考名稱**：`小額代幣包`
- **產品 ID**：`token_pack_small`（必須唯一）
- **價格**：選擇價格等級（例如：等級 1 = NT$ 30）
- **顯示名稱**：`小額代幣包`
- **描述**：`獲得 100 代幣 + 10 贈送代幣`

#### 產品 2：中額代幣包
- **產品 ID**：`token_pack_medium`
- **價格**：等級 5 = NT$ 150
- **顯示名稱**：`中額代幣包`
- **描述**：`獲得 500 代幣 + 50 贈送代幣`

#### 產品 3：大額代幣包
- **產品 ID**：`token_pack_large`
- **價格**：等級 10 = NT$ 300
- **顯示名稱**：`大額代幣包`
- **描述**：`獲得 1000 代幣 + 100 贈送代幣`

5. 點擊「儲存」

### 步驟 4：在 iOS App 中整合 StoreKit

#### 4.1 安裝依賴

```bash
npm install @capacitor-community/in-app-purchase
npx cap sync ios
```

#### 4.2 實作購買流程

在 `src/hooks/usePurchase.tsx` 中：

```typescript
import { InAppPurchase } from '@capacitor-community/in-app-purchase';

export const usePurchase = () => {
  const purchaseTokenPack = async (productId: string) => {
    try {
      // 初始化購買
      await InAppPurchase.initialize();
      
      // 開始購買流程
      const result = await InAppPurchase.purchase({
        productId: productId,
        productType: 'consumable'
      });
      
      // 驗證購買（應該在後端驗證）
      if (result.success) {
        // 呼叫後端 API 驗證並發放代幣
        await verifyPurchase(result.transactionReceipt);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      throw error;
    }
  };
  
  return { purchaseTokenPack };
};
```

### 步驟 5：後端驗證購買

在 Supabase Edge Function 中驗證 App Store 購買：

```typescript
// supabase/functions/verify-app-store-purchase/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { receiptData, productId, userId } = await req.json();
  
  // 使用 App Store Server API 驗證購買
  const response = await fetch(
    'https://buy.itunes.apple.com/verifyReceipt', // 生產環境
    // 'https://sandbox.itunes.apple.com/verifyReceipt', // 測試環境
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': sharedSecret, // 從 App Store Connect 取得
        'exclude-old-transactions': true
      })
    }
  );
  
  const verificationResult = await response.json();
  
  if (verificationResult.status === 0) { // 0 = 成功
    // 發放代幣
    await supabase.rpc('add_tokens', {
      user_id: userId,
      token_amount: getTokenAmount(productId)
    });
    
    return new Response(JSON.stringify({ success: true }));
  }
  
  return new Response(JSON.stringify({ error: 'Invalid purchase' }), { status: 400 });
});
```

### ✅ App Store 內購檢查清單

- [ ] Apple Developer Program 會員資格已取得（$99 USD/年）
- [ ] App Store Connect 應用程式已建立
- [ ] 應用程式內購買項目已建立（至少 3 個代幣包）
- [ ] iOS App 中已整合 StoreKit
- [ ] 後端驗證邏輯已實作
- [ ] 測試購買流程成功

---

## 💳 第三方支付方案（Stripe/PayPal）

如果不想使用平台內購，可以使用第三方支付服務。

### 方案 A：Stripe（推薦）

#### 優點
- 支援 Web、iOS、Android
- 手續費較低（2.9% + $0.30）
- 支援多種支付方式（信用卡、Apple Pay、Google Pay）
- 文檔完善

#### 申請流程

1. **註冊 Stripe 帳號**
   - 前往 [Stripe](https://stripe.com/)
   - 點擊「開始使用」
   - 填寫商家資訊

2. **取得 API 金鑰**
   - 在 Dashboard，導航到「開發者」>「API 金鑰」
   - 複製：
     - **Publishable key**（公開金鑰，用於前端）
     - **Secret key**（秘密金鑰，用於後端，不要暴露）

3. **在 Supabase 中設定**
   - 在 Supabase Dashboard >「Settings」>「Secrets」
   - 添加環境變數：
     - `STRIPE_SECRET_KEY`：您的 Stripe Secret Key
     - `STRIPE_PUBLISHABLE_KEY`：您的 Stripe Publishable Key

4. **實作支付流程**
   - 前端：使用 Stripe.js 建立支付表單
   - 後端：使用 Stripe API 處理支付並發放代幣

### 方案 B：PayPal

#### 優點
- 全球知名
- 支援多種支付方式
- 用戶信任度高

#### 申請流程

1. **註冊 PayPal Business 帳號**
   - 前往 [PayPal](https://www.paypal.com/business)
   - 建立商家帳號

2. **取得 API 憑證**
   - 在 PayPal Developer Dashboard
   - 建立應用程式
   - 取得：
     - **Client ID**
     - **Client Secret**

3. **實作支付流程**
   - 使用 PayPal SDK 或 REST API
   - 處理支付回調並發放代幣

---

## 📊 方案比較

| 方案 | 適用平台 | 手續費 | 申請難度 | 推薦度 |
|------|---------|--------|---------|--------|
| Google Play 內購 | Android | 15-30% | ⭐⭐ 中等 | ⭐⭐⭐⭐ |
| App Store 內購 | iOS | 15-30% | ⭐⭐⭐ 較難 | ⭐⭐⭐⭐ |
| Stripe | Web/iOS/Android | 2.9% + $0.30 | ⭐ 簡單 | ⭐⭐⭐⭐⭐ |
| PayPal | Web/iOS/Android | 2.9% + 固定費 | ⭐ 簡單 | ⭐⭐⭐⭐ |

---

## 🎯 建議實作順序

1. **第一階段**：實作 Stripe（最簡單，適用所有平台）
2. **第二階段**：實作 Google Play 內購（Android 用戶習慣）
3. **第三階段**：實作 App Store 內購（iOS 用戶習慣）

---

## 📝 重要注意事項

### 安全性
- ⚠️ **永遠在後端驗證購買**，不要只依賴前端驗證
- ⚠️ **不要在前端暴露 Secret Key**
- ⚠️ **使用 HTTPS** 傳輸所有支付相關資料

### 測試
- 使用測試環境測試所有支付流程
- Google Play：使用測試帳號
- App Store：使用沙盒測試帳號
- Stripe：使用測試模式

### 合規性
- 遵守各平台的內購政策
- 提供清晰的退款政策
- 確保隱私權政策包含支付資訊處理說明

---

**最後更新**：2025年1月
**適用版本**：最新版

