-- 鎖定保護：勾選時顯示之說明標題與內文（含 {{price}} {{hours}} {{bonus}}）
SELECT public.upsert_ui_text_v2(
  'arena.shieldDetailTitle',
  '鎖定保護機制說明',
  'arena',
  '發表觀點對話框內 Alert 標題',
  '鎖定保護機制說明',
  'Lock protection details',
  'ロック保護の説明'
);

SELECT public.upsert_ui_text_v2(
  'arena.shieldDetailBody',
  $zh$
開啟後，發表成功時將從帳戶扣除 {{price}} 代幣，並套用以下效果：

· 鎖定約 {{hours}} 小時：鎖定期間內，系統對該則留言的「存在週期自然衰減」會暫停。
· 發表時額外增加約 {{bonus}} 分鐘的存在週期。

其他使用者仍可贊同或斥責；斥責仍可能縮短剩餘存在週期（但不會低於 0）。
$zh$,
  'arena',
  '勾選鎖定保險時顯示（佔位 {{price}} {{hours}} {{bonus}}）',
  $zh$
開啟後，發表成功時將從帳戶扣除 {{price}} 代幣，並套用以下效果：

· 鎖定約 {{hours}} 小時：鎖定期間內，系統對該則留言的「存在週期自然衰減」會暫停。
· 發表時額外增加約 {{bonus}} 分鐘的存在週期。

其他使用者仍可贊同或斥責；斥責仍可能縮短剩餘存在週期（但不會低於 0）。
$zh$,
  $en$
When enabled, {{price}} tokens will be deducted on successful post:

· Lock for about {{hours}} h: natural TTL decay pauses for this comment during the lock.
· On post, about {{bonus}} extra minutes of TTL are added.

Others can still agree or disagree; disagree may still reduce remaining TTL (not below 0).
$en$,
  $ja$
有効にすると、投稿成功時に {{price}} トークンが消費されます。

· 約 {{hours}} 時間ロック：期間中は当該コメントの自然TTL減衰が停止します。
· 投稿時に約 {{bonus}} 分のTTLが追加されます。

他ユーザーは賛成・反論できます。反論で残りTTLが減る場合があります（0未満にはなりません）。
$ja$
);
