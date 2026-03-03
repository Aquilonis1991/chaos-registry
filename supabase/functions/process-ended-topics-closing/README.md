# 混亂結語排程（主題結束後自發生成）

此 Edge Function 由**排程**呼叫，會找出「已結束且尚未生成混亂結語」的主題，逐一呼叫 `generate-ai-closing` 寫入 `topic_ai_summary`。  
這樣混亂結語會在主題結束後**自發產生**，不依賴用戶點進該主題才觸發。

## 設定

1. **Supabase 專案環境變數**（Dashboard → Project Settings → Edge Functions → Secrets）  
   - `CRON_SECRET`：自訂一組密碼，排程請求時帶入 header `x-cron-secret`，與此值相同。

2. **排程呼叫**（任選一種）  
   - **Supabase Cron**（若專案有啟用）：在 Dashboard 排程定期 POST  
     `https://<project-ref>.supabase.co/functions/v1/process-ended-topics-closing`  
     Header: `x-cron-secret: <你的 CRON_SECRET>`  
   - **外部 Cron（如 GitHub Actions、cron-job.org）**：同上，定期 POST 並帶 `x-cron-secret`。

建議頻率：每日 1～2 次或每小時 1 次即可。

## 流程

1. 查詢 `topics` 中 `end_at <= now` 且 `ai_summary_generated = false` 的主題。
2. 排除已有 `topic_ai_summary` 的 topic_id。
3. 對每個 topic_id 呼叫 `generate-ai-closing`（帶 `x-cron-secret`），寫入結語並更新 `ai_summary_generated`。
4. 前端詳情頁只從 `topic_ai_summary` 讀取顯示，不再在進入詳情時觸發生成。
