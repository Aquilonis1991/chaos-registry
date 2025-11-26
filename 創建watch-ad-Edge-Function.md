# 🆕 創建 watch-ad Edge Function 詳細步驟

由於 `watch-ad` 函數尚未部署，需要先創建它。

## 方法 1：使用 Supabase CLI（推薦）

### 步驟 1：檢查並安裝 Supabase CLI

```powershell
# 檢查是否已安裝
supabase --version

# 如果沒有安裝，執行：
npm install -g supabase
```

### 步驟 2：登入 Supabase

```powershell
supabase login
```
這會打開瀏覽器讓你登入。

### 步驟 3：連結專案

```powershell
# 切換到專案目錄
cd C:\Users\USER\Documents\Mywork\votechaos-main

# 連結專案
supabase link --project-ref epyykzxxglkjombvozhr
```

### 步驟 4：部署 watch-ad 函數

```powershell
# 部署 watch-ad 函數
supabase functions deploy watch-ad
```

**預期輸出**：
```
Deploying function watch-ad...
Function watch-ad deployed successfully
```

---

## 方法 2：在 Supabase Dashboard 手動創建（如果 CLI 不可用）

### 步驟 1：打開 Supabase Dashboard

1. 前往：**https://supabase.com/dashboard**
2. 登入你的 Supabase 帳號
3. 選擇你的專案（Project ID: `epyykzxxglkjombvozhr`）
4. 在左側選單中點擊 **Edge Functions**

### 步驟 2：創建新函數

1. 點擊右上角的 **"Deploy a new function"** 或 **"Create a new function"** 按鈕
2. 如果沒有看到按鈕，尋找 **"New Function"** 或 **"+"** 按鈕

### 步驟 3：設置函數名稱

1. 函數名稱輸入：`watch-ad`
   - **重要**：名稱必須完全匹配 `watch-ad`（小寫，中間用連字符）
2. 點擊 **Create** 或 **Next**

### 步驟 4：複製函數代碼

1. 打開本地文件：`votechaos-main/supabase/functions/watch-ad/index.ts`
2. **全選並複製**整個文件內容（Ctrl+A, Ctrl+C）

### 步驟 5：貼上代碼並部署

1. 在 Supabase Dashboard 的函數編輯器中：
   - **全選編輯器中的預設代碼**（Ctrl+A）
   - **貼上你複製的代碼**（Ctrl+V）
2. 確認代碼已正確貼上（應該看到 `getSystemConfig` 函數）
3. 點擊右上角的 **Deploy** 或 **Save** 按鈕
4. 等待部署完成（通常幾秒鐘）

### 步驟 6：驗證函數已創建

1. 在 Edge Functions 列表中，確認 `watch-ad` 函數存在
2. 狀態應該顯示為 **Active**
3. 點擊函數名稱可以查看和編輯代碼

---

## 🔍 驗證函數代碼

部署後，確認函數代碼包含以下關鍵部分：

```typescript
// 從 system_config 讀取配置的輔助函數
const getSystemConfig = async (supabaseClient: any, key: string, defaultValue: any): Promise<any> => {
  // ...
};

// 在函數中使用
const MAX_ADS_PER_DAY = await getSystemConfig(supabaseClient, 'max_ads_per_day', 
  await getSystemConfig(supabaseClient, 'mission_watch_ad_limit', 10));
const AD_REWARD = await getSystemConfig(supabaseClient, 'ad_reward_amount',
  await getSystemConfig(supabaseClient, 'mission_watch_ad_reward', 5));
```

---

## ⚠️ 常見問題

### 問題 1：找不到 "Create Function" 按鈕

**解決方案**：
- 確認你已經選擇了正確的專案
- 確認你的帳號有管理員權限
- 嘗試刷新頁面
- 檢查左側選單是否正確顯示 **Edge Functions**

### 問題 2：函數名稱錯誤

**重要**：函數名稱必須是 `watch-ad`（小寫，中間用連字符），不能是：
- ❌ `watch_ad`（下劃線）
- ❌ `WatchAd`（大寫）
- ❌ `watchAd`（駝峰式）

### 問題 3：部署失敗

**檢查清單**：
1. 確認代碼已完整複製（沒有遺漏）
2. 確認沒有語法錯誤
3. 檢查瀏覽器控制台是否有錯誤訊息
4. 嘗試重新部署

---

## 🎯 快速命令（使用 CLI）

```powershell
# 1. 切換到專案目錄
cd C:\Users\USER\Documents\Mywork\votechaos-main

# 2. 登入（如果還沒登入）
supabase login

# 3. 連結專案（如果還沒連結）
supabase link --project-ref epyykzxxglkjombvozhr

# 4. 部署 watch-ad 函數
supabase functions deploy watch-ad

# 5. 驗證函數列表
supabase functions list
```

---

## 📝 完整檢查清單

創建函數後，確認：

- [ ] `watch-ad` 函數已出現在 Edge Functions 列表中
- [ ] 函數狀態為 **Active**
- [ ] 函數代碼包含 `getSystemConfig` 函數
- [ ] 函數代碼從 `system_config` 讀取 `max_ads_per_day` 或 `mission_watch_ad_limit`
- [ ] 已執行 SQL 腳本更新 `add_tokens_from_ad_watch` 函數
- [ ] 已在後台配置中添加 `max_ads_per_day` 配置項

完成後，你的觀看廣告功能就會使用後台配置的限制了！

