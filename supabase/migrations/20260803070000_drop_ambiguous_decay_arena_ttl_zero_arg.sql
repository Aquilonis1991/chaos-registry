-- decay_arena_ttl() 目前有兩個版本共存：無參數版（單純呼叫 decay_arena_ttl(1)）與
-- decay_arena_ttl(p_minutes integer DEFAULT 1)。因為後者有預設值，零參數呼叫時兩者都符合，
-- 導致 cron job 11（SELECT public.decay_arena_ttl();）每次執行都因為
-- "function public.decay_arena_ttl() is not unique" 而失敗。
--
-- 前端（ArenaSection.tsx / ArenaMessagesManager.tsx）呼叫時一律有帶 p_minutes 具名參數，
-- 不會受影響，只有 cron job 的零參數呼叫是問題。直接移除無參數版本，讓零參數呼叫
-- 唯一對應到 decay_arena_ttl(p_minutes DEFAULT 1)，行為完全不變（原本無參數版本
-- 內部本來就是呼叫 decay_arena_ttl(1)）。
DROP FUNCTION IF EXISTS public.decay_arena_ttl();

-- 確認結果：應該只剩一個版本
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'decay_arena_ttl';
