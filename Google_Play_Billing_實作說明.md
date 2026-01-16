# Google Play Billing 內購實作說明

## 📅 實作日期
2026-01-27

## ✅ 已完成功能

### 1. 購買服務初始化 (`src/lib/purchase.ts`)
- ✅ 創建購買服務單例，管理內購初始化
- ✅ 自動註冊所有產品（token_pack_small, token_pack_medium, token_pack_large, token_pack_xlarge）
- ✅ 在 App 啟動時自動初始化（`src/main.tsx`）
- ✅ 支持 Android (Google Play) 和 iOS (App Store)

### 2. 前端購買流程 (`src/hooks/usePurchase.tsx`)
- ✅ 改進購買流程，使用購買服務
- ✅ 完整的錯誤處理（用戶取消、產品不存在、服務未就緒等）
- ✅ 購買驗證後自動刷新代幣餘額
- ✅ 友好的用戶提示（多語言支持）

### 3. 後端驗證 (`supabase/functions/verify-google-play-purchase/index.ts`)
- ✅ 支持 Google Play Developer API v3 驗證（需要 Service Account）
- ✅ 基本驗證（purchaseToken 格式檢查）
- ✅ 防重複購買機制（使用 purchaseToken 作為唯一標識）
- ✅ 完整的購買記錄（包含 metadata：purchaseToken, productId, transactionId 等）

### 4. 資料庫改進
- ✅ 添加 metadata 欄位到 token_transactions 表（Migration: `20260127_add_metadata_to_token_transactions.sql`）
- ✅ 創建索引優化查詢性能（purchaseToken, productId）

## 🔧 技術架構

### 產品 ID 映射
```typescript
{
  1: { android: 'token_pack_small', tokens: 100, bonus: 0 },
  2: { android: 'token_pack_medium', tokens: 500, bonus: 50 },
  3: { android: 'token_pack_large', tokens: 1000, bonus: 150 },
  4: { android: 'token_pack_xlarge', tokens: 3000, bonus: 500 },
}
```

### 購買流程
```
1. 用戶點擊購買按鈕
   ↓
2. usePurchase.purchaseTokenPack(packageId)
   ↓
3. 檢查購買服務是否已初始化
   ↓
4. 獲取產品並檢查是否可購買
   ↓
5. 設置事件監聽器（approved, error）
   ↓
6. 發起購買 order()
   ↓
7. 購買批准後，調用 Edge Function 驗證
   ↓
8. Edge Function 驗證購買並發放代幣
   ↓
9. 完成交易並刷新代幣餘額
```

## ⚙️ 配置要求

### 1. Google Play Console 設置
1. 在 Google Play Console 中創建內購產品：
   - `token_pack_small` (100 代幣)
   - `token_pack_medium` (500 代幣 + 50 贈送)
   - `token_pack_large` (1000 代幣 + 150 贈送)
   - `token_pack_xlarge` (3000 代幣 + 500 贈送)

2. 設置產品為「消耗型產品」（Consumable）

### 2. Supabase 環境變數（可選，用於真實驗證）
```env
GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PLAY_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

**注意**：如果未設置，系統會使用基本驗證（purchaseToken 格式檢查）。生產環境建議設置 Service Account 進行真實驗證。

### 3. 運行 Migration
確保運行以下 migration：
```sql
-- 添加 metadata 欄位
supabase/migrations/20260127_add_metadata_to_token_transactions.sql
```

## 🧪 測試步驟

### 1. 測試環境設置
1. 在 Google Play Console 創建測試帳號
2. 將測試帳號添加到「授權測試人員」列表
3. 使用測試帳號登入設備

### 2. 測試購買流程
1. 打開 App，進入儲值頁面
2. 選擇一個儲值方案
3. 點擊購買按鈕
4. 確認 Google Play 購買對話框出現
5. 完成購買（使用測試帳號）
6. 確認代幣已正確發放
7. 檢查交易記錄

### 3. 測試防重複購買
1. 完成一次購買
2. 嘗試使用相同的 purchaseToken 再次驗證
3. 確認系統拒絕重複購買

## 📝 注意事項

### 開發環境
- 使用 Google Play Console 的測試產品進行測試
- 不需要真實付款即可測試購買流程

### 生產環境
1. **必須**在 Google Play Console 創建真實產品
2. **建議**設置 Google Play Service Account 進行真實驗證
3. **必須**運行 migration 添加 metadata 欄位
4. 測試所有購買方案確保正常工作

### 安全考量
- ✅ 所有購買都在後端驗證
- ✅ 使用 purchaseToken 防止重複購買
- ✅ 完整的交易記錄（包含所有購買信息）
- ⚠️ 生產環境必須啟用 Google Play API 驗證

## 🔍 故障排除

### 問題：產品不存在
**解決方案**：
- 確認產品已在 Google Play Console 中創建
- 確認產品 ID 與代碼中的 ID 完全一致
- 確認產品狀態為「已發布」或「測試中」

### 問題：購買服務未初始化
**解決方案**：
- 檢查 `src/lib/purchase.ts` 是否正確導入
- 檢查 `src/main.tsx` 中是否調用 `purchaseService.initialize()`
- 檢查 cordova-plugin-purchase 插件是否已安裝

### 問題：驗證失敗
**解決方案**：
- 檢查 Supabase Edge Function 日誌
- 確認環境變數已正確設置
- 檢查 purchaseToken 格式是否正確

## 📚 相關文檔

- [Google Play Billing 文檔](https://developer.android.com/google/play/billing)
- [cordova-plugin-purchase 文檔](https://github.com/j3k0/cordova-plugin-purchase)
- [Supabase Edge Functions 文檔](https://supabase.com/docs/guides/functions)

---

**實作狀態**: ✅ 完成
**測試狀態**: ⚠️ 待測試
**生產就緒**: ⚠️ 需要配置 Google Play Console 產品和 Service Account
