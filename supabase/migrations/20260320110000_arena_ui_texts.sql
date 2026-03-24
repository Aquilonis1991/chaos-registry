-- 觀點角鬥場 UI 文字（arena category）
SELECT public.upsert_ui_text_v2(
  'arena.empty',
  '尚未有人留言',
  'arena',
  '觀點角鬥場空狀態',
  '尚未有人留言',
  'No messages yet',
  'まだコメントがありません'
);

SELECT public.upsert_ui_text_v2(
  'arena.coreLabel',
  '核心區',
  'arena',
  '核心區標籤',
  '核心區',
  'Core',
  'コア'
);

SELECT public.upsert_ui_text_v2(
  'arena.eliteLabel',
  '精英區',
  'arena',
  '精英區標籤',
  '精英區',
  'Elite',
  'エリート'
);

SELECT public.upsert_ui_text_v2(
  'arena.ttlRemaining',
  '存在週期剩餘: {{minutes}} 分鐘',
  'arena',
  'TTL 剩餘顯示（{{minutes}} 為佔位）',
  '存在週期剩餘: {{minutes}} 分鐘',
  'TTL remaining: {{minutes}} min',
  '残り: {{minutes}} 分'
);

SELECT public.upsert_ui_text_v2(
  'arena.shieldLocked',
  '[🔒數據鎖定中]',
  'arena',
  '鎖定狀態標記',
  '[🔒數據鎖定中]',
  '[🔒 Locked]',
  '[🔒ロック中]'
);

SELECT public.upsert_ui_text_v2(
  'arena.upvote',
  '贊同 (+{{bonus}})',
  'arena',
  '贊同按鈕（{{bonus}} 為佔位）',
  '贊同 (+{{bonus}})',
  'Upvote (+{{bonus}})',
  '賛成 (+{{bonus}})'
);

SELECT public.upsert_ui_text_v2(
  'arena.downvote',
  '斥責 (-{{penalty}})',
  'arena',
  '斥責按鈕（{{penalty}} 為佔位）',
  '斥責 (-{{penalty}})',
  'Downvote (-{{penalty}})',
  '反論 (-{{penalty}})'
);

SELECT public.upsert_ui_text_v2(
  'arena.postButton',
  '發表觀點',
  'arena',
  '發表觀點按鈕',
  '發表觀點',
  'Post View',
  '投稿する'
);

SELECT public.upsert_ui_text_v2(
  'arena.dialogTitle',
  '發表觀點',
  'arena',
  '發表觀點對話框標題',
  '發表觀點',
  'Post View',
  '投稿'
);

SELECT public.upsert_ui_text_v2(
  'arena.placeholderMaxChars',
  '最多 {{max}} 字',
  'arena',
  '字數 placeholder（{{max}} 為佔位）',
  '最多 {{max}} 字',
  'Max {{max}} chars',
  '最大{{max}}文字'
);

SELECT public.upsert_ui_text_v2(
  'arena.shieldOption',
  '購買數據鎖定保險 ({{price}} 代幣)',
  'arena',
  '鎖定保險選項（{{price}} 為佔位）',
  '購買數據鎖定保險 ({{price}} 代幣)',
  'Buy shield ({{price}} tokens)',
  'シールド購入 ({{price}} トークン)'
);

SELECT public.upsert_ui_text_v2(
  'arena.cancel',
  '取消',
  'arena',
  '取消按鈕',
  '取消',
  'Cancel',
  'キャンセル'
);

SELECT public.upsert_ui_text_v2(
  'arena.submitting',
  '發表中...',
  'arena',
  '發表中狀態',
  '發表中...',
  'Posting...',
  '投稿中...'
);

SELECT public.upsert_ui_text_v2(
  'arena.submit',
  '發表',
  'arena',
  '發表按鈕',
  '發表',
  'Post',
  '投稿'
);

SELECT public.upsert_ui_text_v2(
  'arena.toast.loadFailed',
  '載入失敗',
  'arena',
  '載入失敗 toast',
  '載入失敗',
  'Load failed',
  '読み込み失敗'
);

SELECT public.upsert_ui_text_v2(
  'arena.toast.maxChars',
  '最多 {{max}} 字',
  'arena',
  '字數超限 toast（{{max}} 為佔位）',
  '最多 {{max}} 字',
  'Max {{max}} chars',
  '最大{{max}}文字'
);

SELECT public.upsert_ui_text_v2(
  'arena.toast.postSuccess',
  '已發表',
  'arena',
  '發表成功 toast',
  '已發表',
  'Posted',
  '投稿しました'
);

SELECT public.upsert_ui_text_v2(
  'arena.toast.postFailed',
  '發表失敗',
  'arena',
  '發表失敗 toast',
  '發表失敗',
  'Post failed',
  '投稿に失敗しました'
);

SELECT public.upsert_ui_text_v2(
  'arena.toast.voteFailed',
  '投票失敗',
  'arena',
  '投票失敗 toast',
  '投票失敗',
  'Vote failed',
  '投票に失敗しました'
);
