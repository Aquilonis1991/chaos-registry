# UI 文字管理待處理清單

## ✅ 已完成接入的頁面

### 前端頁面
1. ✅ **NotificationsPage.tsx** - 通知與公告
2. ✅ **AdminPage.tsx** - 後台管理主頁
3. ✅ **MissionPage.tsx** - 任務中心
4. ✅ **HomePage.tsx** - 首頁
5. ✅ **CreateTopicPage.tsx** - 建立主題
6. ✅ **ContactPage.tsx** - 聯絡我們
7. ✅ **RechargePage.tsx** - 儲值頁面
8. ✅ **TokenUsageHistoryPage.tsx** - 代幣使用紀錄
9. ✅ **VoteHistoryPage.tsx** - 投票紀錄
10. ✅ **VoteDetailPage.tsx** - 投票詳情
11. ✅ **AuthPage.tsx** - 登入註冊

### 前端組件
1. ✅ **AnnouncementCarousel.tsx** - 公告輪播
2. ✅ **SearchBar.tsx** - 搜尋欄
3. ✅ **SearchFilters.tsx** - 搜尋篩選
4. ✅ **SearchResults.tsx** - 搜尋結果

### 後台管理組件
1. ✅ **UITextManager.tsx** - UI文字管理
2. ✅ **UserManager.tsx** - 用戶管理

> **注意**：後台管理組件不需要接入 UI 文字管理系統

---

## ✅ 已完成接入的頁面（新增）

### 前端頁面（8個）

1. ✅ **ProfilePage.tsx** - 個人資料頁面
   - 已完成：將所有 `t()` 調用改為 `getText()`，支援多語系切換

2. ✅ **TopicHistoryPage.tsx** - 主題發起紀錄
   - 已完成：所有硬編碼文字已接入 UI 文字管理

3. ✅ **NetworkErrorPage.tsx** - 網路錯誤頁面
   - 已完成：所有錯誤訊息和按鈕文字已接入 UI 文字管理

4. ✅ **ErrorPage.tsx** - 錯誤頁面
   - 已完成：所有錯誤訊息和按鈕文字已接入 UI 文字管理

5. ✅ **NotFound.tsx** - 404 頁面
   - 已完成：支援多語系，已接入 UI 文字管理

6. ✅ **TermsPage.tsx** - 服務條款頁面
   - 已完成：標題和導航部分已接入 UI 文字管理
   - 注意：條款內容本身保持原樣（可後續擴展）

7. ✅ **PrivacyPage.tsx** - 隱私政策頁面
   - 已完成：標題和導航部分已接入 UI 文字管理
   - 注意：政策內容本身保持原樣（可後續擴展）

8. ⚠️ **Index.tsx** - 首頁重定向
   - 狀態：僅為重定向頁面，Loading 文字可選接入
   - 建議：如需要可後續處理

### 前端組件（1個）

1. ✅ **BottomNav.tsx** - 底部導航
   - 已完成：所有導航項目文字已接入 UI 文字管理

---

## 📊 統計

- **已完成**：24 個頁面/組件（新增 9 個）
  - 前端頁面：19 個（新增 8 個）
  - 前端組件：5 個（新增 1 個）
- **待處理**：0 個頁面/組件
  - ~~前端頁面：8 個~~（已完成）
  - ~~前端組件：1 個~~（已完成）
  - ~~後台管理組件：11 個~~（不需要接入）

---

## ✅ 執行完成

### 第一階段（前端用戶頁面）✅
1. ✅ ProfilePage.tsx
2. ✅ TopicHistoryPage.tsx
3. ✅ BottomNav.tsx

### 第二階段（錯誤與條款頁面）✅
4. ✅ NetworkErrorPage.tsx
5. ✅ ErrorPage.tsx
6. ✅ NotFound.tsx
7. ✅ TermsPage.tsx
8. ✅ PrivacyPage.tsx

### ~~第三階段（後台管理組件）~~（已取消）
> 後台管理組件不需要接入 UI 文字管理系統

---

## 🎉 所有前端頁面已完成 UI 文字管理接入！

---

## 📝 注意事項

1. **ProfilePage.tsx** 目前使用 `useLanguage` 的 `t()` 函數，需要統一改為 `useUIText` 的 `getText()`
2. **TermsPage.tsx** 和 **PrivacyPage.tsx** 的條款內容可能需要從資料庫或檔案讀取，而非硬編碼
3. **NotFound.tsx** 目前是英文，需要支援多語系
4. ~~後台管理組件建議統一使用 `admin.*` 作為 key 前綴~~（已取消）
5. 所有硬編碼文字都需要在 `ui_texts` 表中建立對應的 key

