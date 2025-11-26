# 🚀 重新部署 watch-ad Edge Function 詳細步驟

## 方法 1：使用 Supabase CLI（推薦，快速）

### 前置條件檢查

1. **確認已安裝 Supabase CLI**
   ```powershell
   supabase --version
   ```
   如果沒有安裝，執行：
   ```powershell
   npm install -g supabase
   ```

2. **確認已登入 Supabase**
   ```powershell
   supabase login
   ```
   如果未登入，會打開瀏覽器讓你登入。

### 步驟 1：連接到專案

```powershell
# 切換到專案目錄
cd C:\Users\USER\Documents\Mywork\votechaos-main

# 連接到你的 Supabase 專案
supabase link --project-ref epyykzxxglkjombvozhr
```

**注意**：如果已經連結過，會顯示 "Project already linked"，可以跳過這步。

### 步驟 2：部署 watch-ad Edge Function

```powershell
# 只部署 watch-ad 函數
supabase functions deploy watch-ad
```

**預期輸出**：
```
Deploying function watch-ad...
Function watch-ad deployed successfully
```

### 步驟 3：驗證部署

1. 前往 Supabase Dashboard：https://supabase.com/dashboard
2. 登入並選擇你的專案（Project ID: `epyykzxxglkjombvozhr`）
3. 在左側選單中點擊 **Edge Functions**
4. 確認 `watch-ad` 函數存在且狀態為 "Active"
5. 點擊函數名稱查看詳細信息

---

## 方法 2：使用 Supabase 控制台（手動上傳）

### 步驟 1：打開 Supabase Dashboard

1. 前往：https://supabase.com/dashboard
2. 登入你的 Supabase 帳號
3. 在專案列表中選擇你的專案（Project ID: `epyykzxxglkjombvozhr`）
4. 進入專案後，在左側選單中找到並點擊 **Edge Functions**
   - 如果沒看到，可以在左側選單中尋找 **Functions** 或 **Edge Functions** 選項

### 步驟 2：找到 watch-ad 函數

1. 在函數列表中找到 `watch-ad`
2. 點擊函數名稱進入編輯頁面

### 步驟 3：更新函數代碼

1. 打開本地文件：`votechaos-main/supabase/functions/watch-ad/index.ts`
2. **全選並複製**整個文件內容（Ctrl+A, Ctrl+C）
3. 在 Supabase Dashboard 的編輯器中：
   - **全選現有代碼**（Ctrl+A）
   - **貼上新代碼**（Ctrl+V）
4. 確認代碼已更新（應該看到 `getSystemConfig` 函數和從 `system_config` 讀取配置的代碼）

### 步驟 4：部署函數

1. 點擊右上角的 **Deploy** 按鈕
2. 等待部署完成（通常幾秒鐘）
3. 確認看到 "Function deployed successfully" 訊息

### 步驟 5：驗證部署

1. 在函數詳情頁面，確認：
   - 狀態：**Active**
   - 最後更新時間：剛剛的時間
2. 可以點擊 **Test** 按鈕測試函數（可選）

---

## 🔍 驗證配置是否生效

### 方法 1：檢查函數代碼

在 Supabase Dashboard 的 `watch-ad` 函數編輯器中，確認代碼包含：

```typescript
// 從 system_config 讀取配置的輔助函數
const getSystemConfig = async (supabaseClient: any, key: string, defaultValue: any): Promise<any> => {
  // ...
};

// 在函數中使用
const MAX_ADS_PER_DAY = await getSystemConfig(supabaseClient, 'max_ads_per_day', 
  await getSystemConfig(supabaseClient, 'mission_watch_ad_limit', 10));
```

### 方法 2：測試函數

1. 在 Supabase Dashboard 中進入你的專案
2. 點擊左側選單的 **Edge Functions**
3. 找到並點擊 `watch-ad` 函數
4. 在函數詳情頁面，點擊 **Test** 標籤（如果有的話）
5. 輸入測試請求（需要 Authorization header）
6. 檢查響應是否正確

---

## ⚠️ 常見問題

### 問題 1：CLI 命令找不到

**解決方案**：
```powershell
# 安裝 Supabase CLI
npm install -g supabase

# 或使用 npx
npx supabase functions deploy watch-ad
```

### 問題 2：連結專案失敗

**解決方案**：
```powershell
# 檢查是否已連結
supabase projects list

# 如果沒有連結，使用 Access Token
supabase link --project-ref epyykzxxglkjombvozhr
# 輸入你的 Access Token（如果需要的話）
```

### 問題 3：部署後配置仍未生效

**檢查清單**：
1. ✅ 確認已執行 SQL 腳本更新 `add_tokens_from_ad_watch` 函數
2. ✅ 確認後台配置中有 `max_ads_per_day` 或 `mission_watch_ad_limit`
3. ✅ 確認 Edge Function 已成功部署（檢查 Dashboard）
4. ✅ 清除瀏覽器緩存或重新啟動 App

---

## 📝 完整部署檢查清單

- [ ] 已執行 SQL 腳本更新 `add_tokens_from_ad_watch` 函數
- [ ] 已重新部署 `watch-ad` Edge Function
- [ ] 已在後台配置中添加 `max_ads_per_day` 配置項
- [ ] 已驗證 Edge Function 代碼包含 `getSystemConfig` 函數
- [ ] 已測試觀看廣告功能，確認限制已生效

---

## 🎯 快速命令（複製貼上）

```powershell
# 1. 切換到專案目錄
cd C:\Users\USER\Documents\Mywork\votechaos-main

# 2. 連結專案（如果還沒連結）
supabase link --project-ref epyykzxxglkjombvozhr

# 3. 部署 watch-ad 函數
supabase functions deploy watch-ad

# 4. 驗證（可選）
supabase functions list
```

完成後，你的觀看廣告數量限制就會從後台配置讀取！

