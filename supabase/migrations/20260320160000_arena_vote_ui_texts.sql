SELECT public.upsert_ui_text_v2(
  'arena.needLoginVote',
  '請先登入後再互動',
  'arena',
  '匿名點贊同／斥責時提示',
  '請先登入後再互動',
  'Please log in to interact',
  '操作するにはログインしてください'
);

SELECT public.upsert_ui_text_v2(
  'arena.voted',
  '已投票',
  'arena',
  '已對該留言投過票',
  '已投票',
  'Voted',
  '投票済み'
);
