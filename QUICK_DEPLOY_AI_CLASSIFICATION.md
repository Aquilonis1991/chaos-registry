# 🚀 立即部署 ai-user-classification Edge Function

## ⚠️ 重要：代碼已更新，必須重新部署才會生效！

根據 Supabase Dashboard，最後更新時間是 **2026-01-06 6:29 PM**，但我們剛剛更新了代碼（包含【極重要】標記），所以需要重新部署。

## 📋 快速部署方法（推薦）

### 方法：在 Supabase Dashboard 手動更新

1. **前往 Supabase Dashboard**
   - 打開 https://supabase.com/dashboard
   - 選擇 VoteChaos 專案

2. **進入 Edge Functions**
   - 左側選單 → **Edge Functions**
   - 找到 `ai-user-classification` 函數
   - 點擊函數名稱進入詳情頁

3. **編輯代碼**
   - 點擊 **Code** 標籤
   - 點擊 **Edit** 按鈕
   - **全選並刪除**現有代碼

4. **貼上最新代碼**
   - 打開本地文件：`supabase/functions/ai-user-classification/index.ts`
   - **全選並複製**整個文件內容
   - 貼到 Supabase Dashboard 的編輯器中

5. **部署**
   - 點擊 **Deploy function** 或 **Save** 按鈕
   - 等待部署完成（通常幾秒鐘）

6. **驗證部署**
   - 檢查 **Last updated** 時間是否更新為現在的時間
   - 檢查 **Deployments** 數量是否增加（應該從 9 變成 10）

## ✅ 部署後測試

1. 在應用中進入個人資料頁面
2. 點擊「不理性鑑定」按鈕
3. 檢查生成的內容：
   - **稱號**應該是：「不理性投票狂」、「話題製造機」等有趣稱號
   - **側寫**應該是：「你就像是一個...」等惡搞描述
   - **不應該**是：「行為記錄狀態」等系統標籤

## 🔍 如何確認部署成功

在 Supabase Dashboard 中：
- **Code** 標籤 → 檢查是否包含「【極重要】」標記
- **Details** 標籤 → 檢查 **Last updated** 時間是否為最新
- **Logs** 標籤 → 查看是否有新的調用記錄

## 📝 當前代碼特徵

最新代碼包含以下特徵（可用於驗證）：
- 第 115 行：`【重要】你的核心任務是生成「有趣、惡搞、幽默」的內容`
- 第 136 行：`稱號（title）【極重要】必須符合以下條件`
- 第 150 行：`側寫文字（summary）【極重要】必須`
- 第 194-198 行：`【最後提醒】` 區塊

如果 Dashboard 中的代碼沒有這些標記，說明還沒有部署最新版本。

