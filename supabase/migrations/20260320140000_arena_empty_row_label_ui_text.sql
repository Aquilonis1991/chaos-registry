-- 角鬥場空狀態列標籤（與投票截止時間列對齊：左 muted、右主文）
SELECT public.upsert_ui_text_v2(
  'arena.emptyRowLabel',
  '留言狀態',
  'arena',
  '空狀態列左側標籤（對齊截止時間列版式）',
  '留言狀態',
  'Messages',
  'コメント'
);

SELECT public.upsert_ui_text_v2(
  'arena.loading',
  '載入中',
  'arena',
  '角鬥場初次載入無障礙標籤',
  '載入中',
  'Loading',
  '読み込み中'
);
