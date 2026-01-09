# 代幣使用紀錄 UI 文字檢查報告

## 檢查日期
2026-01-07

## 檢查範圍
- `src/hooks/useTokenHistory.tsx` - 代幣歷史資料處理 Hook
- `src/pages/TokenUsageHistoryPage.tsx` - 代幣使用紀錄頁面
- `UI_texts_token_history.csv` - UI 文字定義檔案

## 檢查結果

### ✅ 已修復的問題

1. **硬編碼錯誤訊息**
   - **位置**: `useTokenHistory.tsx` 第 327-328 行
   - **問題**: 使用硬編碼的中文文字
   - **修復**: 
     - `'獲取代幣歷史失敗'` → `getText('tokenHistory.error.fetchFailed', '獲取代幣歷史失敗')`
     - `'載入代幣紀錄失敗'` → `getText('tokenHistory.error.loadFailed', '載入代幣紀錄失敗')`

2. **未知類型 fallback**
   - **位置**: `useTokenHistory.tsx` 第 78 行
   - **問題**: 找不到對應 label 時直接返回 type（非多語系）
   - **修復**: `return labels[type] || getText('tokenHistory.type.unknown', type)`

3. **缺少的 UI 文字定義**
   - **位置**: `UI_texts_token_history.csv`
   - **新增項目**:
     - `tokenHistory.type.aiUsage` - AI 功能
     - `tokenHistory.type.unknown` - 未知類型（fallback）
     - `tokenHistory.description.unstableRewrite` - 不穩定改寫
     - `tokenHistory.description.irrationalityAssessment` - 不理性鑑定
     - `tokenHistory.description.aiUsage` - AI 功能使用（fallback）
     - `tokenHistory.error.fetchFailed` - 獲取代幣歷史失敗
     - `tokenHistory.error.loadFailed` - 載入代幣紀錄失敗

### ✅ 已確認正確的部分

1. **交易類型標籤** (`getTransactionTypeLabel`)
   - ✅ 所有類型都使用 `getText` 函數
   - ✅ 包含 fallback 值
   - ✅ 支援多語系切換

2. **交易描述格式化** (`formatTransactionDescription`)
   - ✅ 所有描述都使用 `getText` 函數
   - ✅ 包含動態參數替換（`{{title}}`, `{{amount}}`, `{{option}}`）
   - ✅ 支援多語系切換

3. **頁面 UI 文字** (`TokenUsageHistoryPage.tsx`)
   - ✅ 所有文字都使用 `getText` 函數
   - ✅ 包含：
     - 頁面標題和副標題
     - 空狀態文字和按鈕
     - 收入/支出徽章
     - 時間格式化（使用 `formatRelativeTime`）

## 多語系支援狀態

### 已支援的語言
- ✅ 繁體中文 (zh)
- ✅ 英文 (en)
- ✅ 日文 (ja)

### UI 文字鍵值對照表

#### 交易類型 (tokenHistory.type.*)
- `createTopic` - 建立主題
- `freeCreateTopic` - 免費建立主題
- `castVote` - 投票
- `freeVote` - 免費投票
- `completeMission` - 完成任務
- `watchAd` - 觀看廣告
- `adminAdjustment` - 系統調整
- `purchase` - 購買
- `aiUsage` - AI 功能 ⭐ 新增
- `unknown` - 未知類型 ⭐ 新增

#### 交易描述 (tokenHistory.description.*)
- `createTopic` - 建立主題：{{title}}
- `freeCreateTopic` - 免費建立主題：{{title}}
- `castVote` - 投票使用 {{amount}} 代幣
- `vote` - 投票：{{title}}
- `voteWithOption` - 投票：{{title}}（選項：{{option}}）
- `watchAdReward` - 觀看廣告獲得 {{amount}} 代幣
- `completeMission` - 完成任務
- `dailyLoginReward` - 每日登入獎勵
- `unstableRewrite` - 不穩定改寫 ⭐ 新增
- `irrationalityAssessment` - 不理性鑑定 ⭐ 新增
- `aiUsage` - AI 功能使用 ⭐ 新增

#### 錯誤訊息 (tokenHistory.error.*)
- `fetchFailed` - 獲取代幣歷史失敗 ⭐ 新增
- `loadFailed` - 載入代幣紀錄失敗 ⭐ 新增

## 建議

1. **匯入新的 UI 文字**
   - 請使用管理後台的 UI 文字管理功能匯入更新後的 `UI_texts_token_history.csv`
   - 或使用 SQL 直接插入新的 UI 文字記錄

2. **測試多語系切換**
   - 確認所有新增的 UI 文字在各語系下都能正確顯示
   - 測試錯誤訊息的顯示

3. **定期檢查**
   - 未來新增新的交易類型或描述時，請確保：
     - 使用 `getText` 函數而非硬編碼
     - 在 CSV 文件中添加對應的多語系文字
     - 包含 fallback 值

## 結論

✅ **所有代幣使用紀錄中的用語都已套用 UI 文字管理，並可在各語系中切換。**

所有硬編碼文字已修復，新增的 UI 文字定義已添加到 CSV 文件中，等待匯入資料庫。


