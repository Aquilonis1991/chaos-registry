-- 角鬥場：每人每主題一則（post_arena_message 錯誤訊息對應前台 UI 文字）
SELECT public.upsert_ui_text_v2(
  'arena.toast.onePerTopic',
  '每個主題僅限發表一則觀點',
  'arena',
  '每人每主題僅能發表一則角鬥場留言（對應 RPC）',
  '每個主題僅限發表一則觀點',
  'One message per topic allowed',
  '1トピックにつき1件まで'
);
