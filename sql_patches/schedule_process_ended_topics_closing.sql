-- ========================================
-- 混亂結語排程：每小時檢查「未有結語」的已結束主題並自動補上結語
-- ========================================
-- 行為：每小時整點執行一次，找出 end_at <= now 且尚無 topic_ai_summary 的主題，
--       逐一呼叫 generate-ai-closing 寫入結語。
-- 前置：請先完成「混亂結語_設定與執行步驟.md」方案 A 的「步驟 1：寫入 Vault 密碼」，
--       再執行本檔。
-- 需求：Database 需從 Dashboard → Extensions 啟用 pg_cron、pg_net；
--       Vault 需有 cron_secret_closing、supabase_anon_key（見步驟 2）。
-- ========================================

-- 若已有同名排程先刪除（方便重複執行）
select cron.unschedule('process-ended-topics-closing')
where exists (select 1 from cron.job where jobname = 'process-ended-topics-closing');

-- 排程：每小時整點執行（0 * * * *）
-- Headers 從 Vault 讀取：supabase_anon_key（Bearer）、cron_secret_closing（x-cron-secret）
select cron.schedule(
  'process-ended-topics-closing',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/process-ended-topics-closing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_closing' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- 若要改為「每天 00:00 與 12:00」可改成：
-- select cron.schedule('process-ended-topics-closing', '0 0,12 * * *', $$ ... $$);
