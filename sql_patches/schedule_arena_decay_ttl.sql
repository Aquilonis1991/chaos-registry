-- ========================================
-- 觀點角鬥場 TTL 衰減排程：每分鐘執行
-- ========================================
-- 前置：完成 migrations 20260320100000 ~ 20260320104000
-- 需求：Database 啟用 pg_cron
-- ========================================

select cron.unschedule('arena-decay-ttl')
where exists (select 1 from cron.job where jobname = 'arena-decay-ttl');

select cron.schedule(
  'arena-decay-ttl',
  '* * * * *',
  $$ select public.decay_arena_ttl(1) $$
);
