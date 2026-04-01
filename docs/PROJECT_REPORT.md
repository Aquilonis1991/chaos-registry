# ChaosRegistry 專案詳細報告

**對外產品名稱：ChaosRegistry。** 程式庫目錄與部分套件／套件識別仍可能使用 **VoteChaos**、`votechaos` 等內部代號，文件若未另述，產品面向使用者、商店與對外溝通請以 **ChaosRegistry** 為準。

依 **votechaos-main** 程式庫實際結構整理，供內部文件或交接使用。

---

## 1. 專案定位與整體架構

**ChaosRegistry** 以投票、主題、代幣與社群互動為核心：同一套 **React + Vite** 前端，透過 **Capacitor 6** 包成 Android／iOS 原生殼；資料與業務規則集中在 **Supabase**（PostgreSQL、Auth、RLS、PostgREST、**Edge Functions**、SQL migrations）。

- `package.json` 版本號以當前分支為準（撰寫時參考值曾為 **1.0.104**）。
- Android AAB：`npm run build:aab`（含 `vite build`、`cap sync android` 與自訂腳本）。

---

## 2. 各系統內容與作法（高層）

| 區塊 | 內容概要 | 典型作法 |
|------|----------|----------|
| **帳號與身分** | 登入、權限、管理員判斷 | Supabase Auth + 前端 `AuthContext`；後台 `useAdmin` |
| **主題／投票** | 建立主題、選項、付費／免費票、瀏覽詳情 | 資料表 + 客戶端查詢；關鍵動作可走 Edge（`create-topic`、`cast-vote`、`cast-free-vote`） |
| **代幣經濟** | 餘額、加扣、內購入帳 | DB RPC／交易紀錄；內購經驗證 Edge 入帳 |
| **觀點角鬥場** | 場內訊息、互動與管理 | 前端區塊元件；後台 **ArenaMessagesManager** |
| **任務／廣告獎勵** | 看廣告後領獎等 | Edge **`watch-ad`**：驗證使用者、讀 `system_config`、寫入獎勵 |
| **AI 能力** | 文案改寫、結語、使用者分類 | `ai-chaos-rewrite`、`generate-ai-closing`、`ai-user-classification`；`process-ended-topics-closing` 等流程 |
| **第三方登入** | LINE、Twitter 等 | `line-auth`、`line-auth-callback`、`twitter-auth` |
| **存取與設定** | 功能開關、遠端參數 | `get-system-config`、`access-control`；後台 **SystemConfigManager** |
| **後台營運** | 營運操作介面 | **`AdminPage`** + 多個 `*Manager` 分頁 |

---

## 3. 使用技術

### 前端

- React 18、TypeScript、Vite 5、React Router 6、TanStack Query  
- React Hook Form + Zod、Tailwind CSS、Radix UI（shadcn 風格）、Sonner、date-fns、Recharts 等  

### 資料與後端

- `@supabase/supabase-js`  
- Supabase **Deno Edge Functions**（`supabase/functions` 內多支 `index.ts`）  

### 原生殼

- Capacitor 6：App、StatusBar、Keyboard、Splash、Push、Browser、Device、Haptics、Toast 等  

### 廣告

- `@capacitor-community/admob`  
- 本地套件 **`@votechaos/native-ad-plugin`**（`file:native-ad-plugin`，`postinstall` 會嘗試 build）  

### 內購

- **cordova-plugin-purchase**（v13，`CdvPurchase.store`）  

### 品質／工具

- ESLint、Playwright（dev）、Capacitor CLI  

---

## 4. Edge Functions 一覽

路徑：`supabase/functions/`

| 函式名稱 | 角色（摘要） |
|----------|----------------|
| `access-control` | 存取控制 |
| `ai-chaos-rewrite` | AI 改寫 |
| `ai-user-classification` | 使用者分類 |
| `cast-free-vote` | 免費票投票 |
| `cast-vote` | 付費／一般投票流程 |
| `check-auth-providers` | 查核綁定之登入提供者 |
| `complete-mission` | 任務完成 |
| `create-topic` | 建立主題 |
| `generate-ai-closing` | AI 產生結語 |
| `get-system-config` | 讀取系統設定 |
| `initiate-purchase` | 購買流程初始化（伺服器端輔助） |
| `line-auth` / `line-auth-callback` | LINE OAuth |
| `process-ended-topics-closing` | 已結束主題結語等批次處理 |
| `twitter-auth` | Twitter OAuth |
| `verify-app-store-purchase` | App Store 內購驗證 |
| `verify-google-play-purchase` | Google Play 內購驗證 |
| `watch-ad` | 看廣告獎勵（頻率／上限等讀 `system_config`） |

與 App／Web 透過 `supabase.functions.invoke` 或 HTTP，並搭配 CORS 白名單。

---

## 5. 後台現有功能

入口：**`src/pages/AdminPage.tsx`**（Tabs 分區）。

| 分頁 | 元件 | 說明 |
|------|------|------|
| 用戶管理 | `UserManager` | 可轉至用戶限制 |
| 通知管理 | `NotificationManager` | 推播／站內通知營運 |
| 聯絡訊息 | `ContactMessageManager` | 使用者聯絡表單 |
| 檢舉管理 | `ReportManager` | 可跳轉主題分頁 |
| 主題管理 | `TopicManager` | 主題營運 |
| 觀點角鬥場 | `ArenaMessagesManager` | 場內訊息管理 |
| 數據匯出 | `DataExportManager` | 匯出資料 |
| 用戶限制 | `UserRestrictionManager` | 限制／封禁等 |
| 安全管理 | `SecurityManager` | 安全相關設定 |
| UI 文字管理 | `UITextManager` | 多語／文案 |
| 系統配置 | `SystemConfigManager` | 遠端參數（含廣告 unit、列表間隔等） |
| 公告顯示 | `AnnouncementManager` | 公告 |
| 禁字表 | `BannedWordsManager` | 敏感詞 |
| 條款管理 | `LegalContentManager` | 條款內容 |
| AI 管理 | `AiPromptManager` | AI 提示詞等 |

非管理員會導回首頁；載入過久時可清除 `admin_status_cache` 並重新載入。

---

## 6. 串接的廣告

### Google AdMob（`@capacitor-community/admob`）

- 主要實作：**`src/lib/admob.ts`**
- 能力：初始化、**Banner**、**Interstitial**、**Rewarded（獎勵影片）**
- 測試：Google 官方測試廣告 ID
- 正式：通常由 **`system_config`** 搭配 `getAdId` / `getNativeAdUnitId`
- Web：多半跳過真實載入或使用測試模擬，避免在非原生環境呼叫原生 API

### 原生廣告（Native Ad）

- 套件：**`@votechaos/native-ad-plugin`**
- 元件：**`NativeAdCard`** — 動態 `import`，`NativeAd.loadNativeAd({ adUnitId })`
- 首頁：**`HomePage`** 以 `getNativeAdUnitId` 讀設定，在列表中插入原生廣告卡

### 與後端

- **`watch-ad`**：使用者完成獎勵廣告後由 App 觸發，後端依設定驗證並發放獎勵

---

## 7. 內購（IAP）

### 前端（`src/lib/purchase.ts`）

- **cordova-plugin-purchase**：等待 **`CdvPurchase.store`**，註冊 **消耗型** 商品

### 商品 ID（`PRODUCT_ID_MAP`）

| 檔位 | Android SKU | iOS SKU | 代幣（範例，以程式為準） |
|------|-------------|---------|---------------------------|
| 1 | `token_pack_small` | `token_pack_30` | 100 |
| 2 | `token_pack_medium` | `token_pack_150` | 600 |
| 3 | `token_pack_large` | `token_pack_290` | 1300 |
| 4 | `token_pack_xlarge` | `token_pack_790` | 4000 |

須與 Google Play / App Store 後台 SKU 一致。

### 後端驗證

- **Google Play**：`verify-google-play-purchase`  
- **App Store**：`verify-app-store-purchase`  
- DB 層可搭配 **`process_google_play_purchase_deposit`** 與 **`purchaseToken` 唯一索引** 防重複發幣（見 migrations）

### 其他

- **`initiate-purchase`**：伺服器端帶 `package_id`、`product_id`、`platform` 的流程輔助；實際入帳以驗證函式與 DB 為準  
- UX：`usePurchase`、`purchaseRecovery`、`AuthContext`、`PurchaseRecoveryToastGate` 等處理補單與延遲入帳提示  

### 注意事項

- Google Play 內購綁定 **applicationId**；debug 與 release 套件名不同時，測試內購可能無法對應正式商品。

---

## 8. 分支與維護備註

若倉庫仍維護 **`main` / `android` / `ios`** 等分支，版號與功能（例如兌換碼相關 UI）可能不同步；文件與建置請**以當前 checkout 分支為準**，並比對 `AdminPage` 與 migrations。

---

## 9. 延伸文件（可選補強）

- 每條 **React Router 路由 ↔ 頁面** 對照表  
- **migrations** 內 RPC／表名／RLS 摘要  
- 各 Edge Function 的 **Request／Response JSON 合約**

可依需求再從 `src/pages`、`App` 路由、`supabase/migrations` 掃描補齊。
