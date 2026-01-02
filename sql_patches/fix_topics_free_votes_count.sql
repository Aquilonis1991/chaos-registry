-- 補上 topics 表缺少的 free_votes_count 欄位
-- 用於修復 "column free_votes_count does not exist" 錯誤

BEGIN;

ALTER TABLE public.topics
ADD COLUMN IF NOT EXISTS free_votes_count INTEGER DEFAULT 0;

-- 如果有存量數據，這裡可以考慮是否要嘗試統計 (選用)
-- UPDATE public.topics 
-- SET free_votes_count = (SELECT count(*) FROM public.free_votes WHERE topic_id = topics.id);

COMMIT;
