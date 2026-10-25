-- 每天台灣時間 08:10（UTC 00:10）回覆已結束主題的 Threads 結果。
-- Headers 從 Vault 讀取：supabase_anon_key、cron_secret_closing（與混亂結語排程同一組）。
select cron.schedule(
  'threads-vote-recap',
  '10 0 * * *',
  $$
  select net.http_post(
    url := 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/threads-vote-recap',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_anon_key' limit 1),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_closing' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
