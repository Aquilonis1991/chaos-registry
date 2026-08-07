-- CRITICAL SECURITY FIX：process_google_play_purchase_deposit 剛套用時只寫了
-- REVOKE ALL ... FROM PUBLIC，沒有明確對 anon / authenticated REVOKE。
-- 這個專案的 public schema 對新建函式預設會授予 anon/authenticated 執行權限
-- （跟這次 session 前面修的 add_tokens 等函式是同一個根本原因），套用後直接查證
-- 發現 anon（完全未登入）就能直接呼叫這支函式，且 p_total_tokens 由呼叫者完全決定、
-- 函式內部只檢查 > 0，沒有上限——等於任何人都能無限刷代幣，比原本的 add_tokens 漏洞更直接。
-- 立即補上明確的 REVOKE。
REVOKE EXECUTE ON FUNCTION public.process_google_play_purchase_deposit(
  uuid, text, text, text, text, text, int, int, text, int
) FROM PUBLIC, anon, authenticated;

-- 確認結果：anon/authenticated 應皆為 false，service_role 應為 true
SELECT
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_exec,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'process_google_play_purchase_deposit';
