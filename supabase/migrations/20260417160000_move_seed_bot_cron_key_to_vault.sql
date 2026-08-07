-- seed-bot 的 cron job（jobid=2）原本把 service role JWT 明文寫在 cron.job.command 裡，
-- 任何能進 SQL Editor 查 cron.job 的人都看得到完整金鑰。改成跟 jobid=1
-- （process-ended-topics-closing）一樣，從 Supabase Vault 動態讀取。
--
-- ⚠️ 這個檔案裡的 <PASTE_YOUR_SERVICE_ROLE_KEY_HERE> 只是 placeholder，
-- 不要把真正的金鑰值寫進這個檔案再 commit 進 git——這樣只是把外洩管道從
-- cron.job 換成 git 歷史紀錄，一樣不安全。實際執行時，把下面這段複製到
-- SQL Editor，在編輯器裡手動把 placeholder 換成真正的金鑰再執行，
-- 不要把填好金鑰的版本存回這個檔案。

-- 1. 把金鑰存進 Vault（若已存在同名 secret，先刪除再建立，避免重複）
select vault.create_secret(
  '<PASTE_YOUR_SERVICE_ROLE_KEY_HERE>',
  'seed_bot_service_role_key',
  'seed-bot cron job 用的 service role key，2026-08 從 cron.job 明文改存 Vault'
);

-- 2. 更新 cron job，改成從 Vault 讀取，不再寫死金鑰
select cron.alter_job(
  job_id := 2,
  command := $cmd$
    SELECT net.http_post(
        url := 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/seed-bot',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'seed_bot_service_role_key' limit 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
    ) as request_id;
  $cmd$
);

-- 3. 確認結果：command 欄位不應該再看得到原本的明文 JWT
select jobid, schedule, command from cron.job where jobid = 2;
