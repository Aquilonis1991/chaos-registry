-- Topic share dialog: editable random template + copy only; claim tokens on Mission page

INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES
  (
    'topic.share.subtitle',
    '已隨機套用一種語氣，可自行修改後複製分享',
    'topic',
    '分享對話框副標題（隨機一則可編輯）',
    '已隨機套用一種語氣，可自行修改後複製分享',
    'A random tone is applied—edit freely, then copy to share.',
    'ランダムにトーンを適用しました。編集してからコピーしてシェアできます'
  ),
  (
    'topic.share.copyAndShareButton',
    '複製並分享',
    'topic',
    '分享對話框主按鈕：複製到剪貼簿（不發代幣）',
    '複製並分享',
    'Copy & share',
    'コピーしてシェア'
  ),
  (
    'topic.share.toast.afterCopyHint',
    '請貼到 LINE / Threads 等；每日獎勵請至任務頁領取',
    'topic',
    '複製成功後說明：引導任務頁領獎',
    '請貼到 LINE / Threads 等；每日獎勵請至任務頁領取',
    'Paste to LINE / Threads. Claim your daily reward on the Missions page.',
    'LINE / Threads などに貼り付け。デイリー報酬はミッション画面で受け取ってください'
  ),
  (
    'topic.share.missionHint',
    '代幣獎勵請至「任務」頁完成領取（每日一次）',
    'topic',
    '文案下方小字提示',
    '代幣獎勵請至「任務」頁完成領取（每日一次）',
    'Claim token rewards on the Missions page (once per day).',
    'トークン報酬は「ミッション」で受け取ってください（1日1回）'
  ),
  (
    'topic.share.draft.aria',
    '分享文案，可編輯',
    'topic',
    '分享文案 textarea aria-label',
    '分享文案，可編輯',
    'Share text, editable',
    'シェア文（編集可）'
  ),
  (
    'topic.share.emptyDraft',
    '請先輸入要分享的內容',
    'topic',
    '複製時內容為空',
    '請先輸入要分享的內容',
    'Enter some text to share first.',
    '共有する内容を入力してください'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();

UPDATE public.ui_texts SET
  value = '使用分享功能複製文案後，前往任務頁領取每日獎勵（每日一次）',
  zh = '使用分享功能複製文案後，前往任務頁領取每日獎勵（每日一次）',
  en = 'After copying share text, claim the daily reward on the Missions page (once per day).',
  ja = 'シェア文をコピー後、ミッション画面でデイリー報酬を受け取る（1日1回）',
  description = '任務列表：每日分享任務說明（領獎在任務頁）',
  updated_at = now()
WHERE key = 'mission.list.12.description';

UPDATE public.ui_texts SET
  value = '於任務頁領取分享獎勵 1 次',
  zh = '於任務頁領取分享獎勵 1 次',
  en = 'Claim the share reward once on the Missions page.',
  ja = 'ミッション画面でシェア報酬を1回受け取る',
  description = '任務列表：每日分享任務條件',
  updated_at = now()
WHERE key = 'mission.list.12.condition';

NOTIFY pgrst, 'reload schema';
