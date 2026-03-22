-- 單獨 GRANT（與 CREATE 同檔會觸發 Supabase prepared statement 多語句錯誤）
GRANT EXECUTE ON FUNCTION public.create_topic_atomic TO authenticated;
