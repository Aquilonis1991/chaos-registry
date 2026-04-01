# ChaosRegistry (VoteChaos) 專案總體白皮書與技術報告
**文件更新日期：2026-04-01**

**產品對外正式名稱：ChaosRegistry**。
*(註：程式庫目錄與部分套件可能仍會使用內部代號 `VoteChaos` 或 `votechaos`，但在對外商店、用戶條款與 PR 中皆以 `ChaosRegistry` 為準。)*

本報告為本專案的「聖經」與開發者指南，詳盡列出當前系統架構、經濟模型、核心演算法以及前端與伺服器端的防禦機制。

---

## 1. 專案定位與基礎技術棧
**ChaosRegistry** 是一個以話題投票、觀點激辯、實時互動與代幣經濟為核心的社群 App。
採用全端分離架構，前端包裝為 Android/iOS 雙平台原生 App。

* **前端框架**：React 18 + TypeScript + Vite 5 + React Router 6 + TanStack Query
* **原生橋接殼**：Capacitor 6 (負責調用 StatusBar, Keyboard, Push, Haptics 等原生硬體)
* **UI/UX 套件**：Tailwind CSS + Radix UI (shadcn/ui) + Sonner (Toast) + Recharts
* **後端與資料庫**：Supabase (PostgreSQL + RLS 機制) + Supabase Auth
* **無伺服器 API**：Supabase Deno Edge Functions
* **連線層防護**：RPC 安全呼叫 + CORS 嚴格白名單設定

---

## 2. 代幣經濟與獎勵系統 (Tokenomics)
本專案採用封閉式代幣循環經濟，包含「儲值入金」、「操作消耗」與「任務激勵」三大板塊。

### 2.1 內購儲值與定價 (IAP)
前端由 `cordova-plugin-purchase` 實作，並透過 `verify-google-play-purchase` 或 `verify-app-store-purchase` Edge Function 在後台收據驗證後發幣。
對應 `PRODUCT_ID_MAP` 的四個檔位：
* **小包裝 (Small Pack):** 30 元台幣 = 100 代幣
* **中包裝 (Medium Pack):** 150 元台幣 = 600 代幣
* **大包裝 (Large Pack):** 290 元台幣 = 1300 代幣
* **超大包裝 (XLarge Pack):** 790 元台幣 = 4000 代幣

*(並具備「儲值補單功能」，`PurchaseRecoveryToastGate` 會攔截並接續中斷的付款)*

### 2.2 功能消耗收費 (Cost)
各項操作門檻與系統級扣除代幣設定：
* **發起主題**：目前免費 (每日享有首次發送折抵 5 代幣)
* **擴充投票選項**：+40 代幣 / 個
* **主題存活時間延長**：+1天(30代幣)、+2天(50代幣)、+3天(70代幣)
* **版面高度曝光方案**：
  * **High (最高級)**：150 代幣 (維持120分鐘)
  * **Medium (中級)**：60 代幣 (維持60分鐘)
  * **Normal (一般)**：5 代幣
* **角鬥場防護罩購買**：100 代幣 (凍結時間流動約 3 小時)
* **不穩定 AI 改寫／禁字鑑定**：5 代幣 / 次 (發言每日首次免費)

### 2.3 任務激勵與獲取 (Reward)
* **新用戶創辦解鎖**：+50 代幣
* **看廣告任務 (每日 10 次上限)**：+10 代幣 / 次
* **每日登入簽到**：+3 代幣
* **連續登入 7 天累計獎勵**：+50 代幣
* **連續登入 5 天特殊獎勵**：獲得「免費發起主題」資格一次
* **成就型任務**：
  * 首投新手 (+50)
  * 首次發文創造者 (+30)
  * 更名形象更新 (+20)
  * 累投10主題愛好者 (+50)
* **常態回饋**：參與一般投票每次可獲 +2 代幣

---

## 3. 防霸榜熱門演算法 (10,000 DAU 承受力)
有鑒於大流量社群容易發生「極端高票萬年霸榜」與「課金置頂無限期」的災難，本專案首頁熱門分頁 (`get_hot_topics_with_exposure`) 採用基於 **Hacker News 與 Reddit** 經典邏輯改良的 **「萬人級絕對混合衰減演算法」**：

1. **時間重力系統 (Gravity Model)**：
   時間衰減公式為 `(存在小時數 + 2)^1.5` 作為分母。年輕的主題分數極高，但在 48~72 小時後因指數性質，分數會瞬間被稀釋數百倍，強迫老文章讓位，保證論壇流水換血。
2. **防通膨曲線 (Anti-Inflation)**：
   單一主題即便湧入十萬票，公式 `POWER(總票數, 0.8)` 也能將其壓縮至平滑增長，不會讓單一事件的極端狂熱壓垮伺服器整體的算分平衡。
3. **曝光絕對強制力 (Absolute Boost)**：
   用戶購買的高級曝光會在 `v_boost` 中注入強大的常數 (+500 或 +200)。在此加成下，剛發布的付費文章將無視所有演算法「無條件降臨首頁榜首」。
4. **雲端即時掉階驗證**：
   不把曝光等級寫死在主題上，而是即時 Lookup `exposure_applications` 檢查時間。兩小時期限一到，高級曝光文章會自動落入凡間，接受自然重力的檢驗。

---

## 4. 全域時間防護機制 (Time-Integrity Audit)
為杜絕用戶透過修改手機作業系統時間來作弊（例如白嫖每日簽到、迴避發言冷卻、讓主題提前結束等），前端已「完全廢除對本地時間的信任」。

* **核心機制 (`useServerTime`)**：
  App 喚醒時會自動 Fetch 後端的 `REST/v1` 取得時間標頭，並計算 `TimeOffset (伺服器時間 - 本機時間)`。
* **廣泛防護範圍**：
  * 角鬥場防護罩 (`ArenaSection`)：無敵時間鎖定不可被手機調慢時間破解。
  * 主題生命週期 (`HomePage`, `VoteDetailPage`)：主題結束的倒數計時強制與雲端同步。
  * 黑名單與禁言 (`UserRestrictionManager`)：停權期限嚴密執行。
  * 每日狀態刷新 (`useMissionOperations`)：UTC 過午夜判定交由伺服器 offset。

---

## 5. 核心互動：觀點角鬥場 (Arena)
主題內頁特設的「觀點角鬥場」是極具特色的 UGC (使用者生成內容) 系統。
* **機制**：用戶需消耗門檻（如該主題有一定投票參與度）才可發布觀點。
* **存在週期 (TTL)**：每則留言具有「生命分鐘數」。只要被按「斥責(Downvote)」時間就會縮短；被按「贊同(Upvote)」就會延長。
* **回收站**：當 TTL 歸零，該發言會被「系統軟回收」，轉為灰色的回收紀錄碑。
* **鎖定保險**：用戶可花費代幣購買盾牌設定，保護自己的發言暫時不被時間與斥責所消滅。

---

## 6. 後台 Edge Functions 與 RPC 總表
所有牽涉金流、安全規則、第三方認證的邏輯皆不在客戶端進行。

### 重點 Edge Functions (`supabase/functions/`)
* **`line-auth` / `line-auth-callback`**：實作 LINE 第三方安全登入，並整合 App Deep Link 回調 (`votechaos://auth/callback`)。
* **`twitter-auth`**：Twitter (X) OAuth2 登入連動。
* **`watch-ad`**：看廣告發獎勵引擎，內建防呆與每日 10 次上限查核。
* **`ai-chaos-rewrite`** / **`generate-ai-closing`**：結合大語言模型，提供自動生成嘲諷結語以及協助用戶改寫違規內容。
* **`verify-app-store-purchase`** / **`verify-google-play-purchase`**：雙平台收據防偽驗證。

### 重點 Database RPC (安全預存程序)
* `add_tokens` / `deduct_tokens`：代幣增減原子操作。
* `log_token_transaction`：代幣消費與獲取精準記帳。
* `get_hot_topics_with_exposure`：首頁防暴雷大會戰演算法輸出。
* `complete_mission_safe`：任務完成與發獎的原子打包處理，防止連點併發刷獎。
* `cast_arena_vote`：角鬥場投票原子操作。

---

## 7. 營運與後台超級管理器 (AdminPanel)
僅有具備最高權限的 `admin` 帳號可進入 `src/pages/AdminPage.tsx`，此處分為以下管理儀表板：
1. **UserManager (用戶管理)**：發放代幣、查看動態。
2. **UserRestrictionManager (用戶限制)**：禁言、封鎖發言權。
3. **NotificationManager (通知推播)**：發送全服公告與推播。
4. **ArenaMessagesManager (角鬥場監管)**：強行回收或刪除不當觀點。
5. **ReportManager (檢舉雷達)**：處理前線群眾檢舉。
6. **SystemConfigManager (遠端動態配置)**：更改全部代幣價格、經驗值門檻等 (即時生效，無需更新 App 版本)。
7. **BannedWordsManager (敏感禁字表)**：管理全服過濾字典。
8. **AiPromptManager**：微調系統 AI 運作的人設與語氣。

---

## 8. 動態廣告串接系統 (AdMob & Native Ads)
專案採混和廣告盈利模式：
* **獎勵影片廣告 (Rewarded Ads)**：
  透過 `@capacitor-community/admob` 呼叫原生層載入 AdMob 廣告，觀看完畢觸發 `watch-ad` 派發 10 代幣。
* **原生資訊流廣告 (Native Ads)**：
  透過客製化 Native 插件 `@votechaos/native-ad-plugin` 實體化，散布於用戶首頁的無感資訊流中，將廣告與話題列表完美融合。

---
*文件編纂：Antigravity Agent (2026 基準更新)*
