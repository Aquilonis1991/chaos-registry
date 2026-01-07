# 部署 ai-user-classification Edge Function

## ⚠️ 重要提醒

**代碼已經更新，但必須重新部署 Edge Function 才會生效！**

## 📋 部署步驟

### 方法 1：使用 Supabase CLI（推薦）

```powershell
# 1. 確認已登入 Supabase
npx supabase login

# 2. 確認專案已連結（專案 ID: epyykzxxglkjombvozhr）
npx supabase link --project-ref epyykzxxglkjombvozhr

# 3. 部署 ai-user-classification Edge Function
npx supabase functions deploy ai-user-classification
```

### 方法 2：在 Supabase Dashboard 手動更新

1. 前往 https://supabase.com/dashboard
2. 選擇 VoteChaos 專案
3. 左側選單 → **Edge Functions**
4. 找到 `ai-user-classification` 函數
5. 點擊 **Edit** 或 **Update**
6. 複製 `supabase/functions/ai-user-classification/index.ts` 的完整內容
7. 貼到編輯器中
8. 點擊 **Deploy function** 或 **Save**

## ✅ 驗證部署

部署完成後，請：
1. 在個人資料頁面執行「不理性鑑定」
2. 檢查生成的稱號是否為有趣、人格化的稱號（如「不理性投票狂」）
3. 檢查生成的側寫是否為惡搞、幽默的描述

## 🔍 如果仍然生成系統性標籤

如果部署後仍然生成「行為記錄狀態」這類系統標籤，請：
1. 檢查 Supabase Dashboard → Edge Functions → ai-user-classification → Logs
2. 查看是否有錯誤訊息
3. 確認部署的版本是否為最新（檢查代碼中的 prompt 是否包含「【極重要】」標記）

