-- 手動執行用：每日分享任務 + UI 文案（等同依序執行下列 migration）
--   20260403000000_add_daily_share_mission.sql
--   20260403001000_add_ui_texts_daily_share_and_topic_share.sql
-- 在 Supabase Dashboard → SQL Editor 整段貼上執行即可（可重複執行，具 ON CONFLICT 冪等）。

-- === 以下自 20260403000000 ===

-- Daily share mission: one claim per calendar day (Taipei) via complete_mission_safe + limit_per_day = 1

INSERT INTO public.system_config (key, value, category, description)
VALUES ('mission_daily_share_reward', '10'::jsonb, 'mission', '每日「口耳相傳」分享任務獎勵（代幣）')
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

INSERT INTO public.missions (id, name, condition, reward, limit_per_day)
VALUES (
  'daily_share_1',
  '每日口耳相傳',
  '分享主題到社群並完成分享回報（每日一次）',
  10,
  1
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  condition = EXCLUDED.condition,
  limit_per_day = EXCLUDED.limit_per_day;

UPDATE public.missions SET reward = COALESCE(
  (SELECT NULLIF(TRIM(value #>> '{}'), '')::integer FROM public.system_config WHERE key = 'mission_daily_share_reward' LIMIT 1),
  reward
)
WHERE id = 'daily_share_1';

NOTIFY pgrst, 'reload schema';

-- === 以下自 20260403001000 ===

-- UI texts: daily share mission (mission.list.12) + topic share dialog

INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES
  (
    'mission.list.12.name',
    '每日口耳相傳',
    'mission',
    '任務列表：每日分享任務名稱',
    '每日口耳相傳',
    'Daily Word of Mouth',
    'デイリー口コミ'
  ),
  (
    'mission.list.12.description',
    '分享主題到社群並完成分享回報（每日一次）',
    'mission',
    '任務列表：每日分享任務說明',
    '分享主題到社群並完成分享回報（每日一次）',
    'Share a topic and tap complete once per day.',
    'トピックをSNSでシェアし、完了を1日1回タップする'
  ),
  (
    'mission.list.12.condition',
    '完成分享回報 1 次',
    'mission',
    '任務列表：每日分享任務條件',
    '完成分享回報 1 次',
    'Complete share confirmation once',
    'シェア完了を1回報告する'
  ),
  (
    'topic.share.title',
    '分享這個話題',
    'topic',
    '分享對話框標題',
    '分享這個話題',
    'Share this topic',
    'このトピックをシェア'
  ),
  (
    'topic.share.subtitle',
    '選一則文案複製，貼到 LINE / Threads 等',
    'topic',
    '分享對話框副標題',
    '選一則文案複製，貼到 LINE / Threads 等',
    'Pick a template, copy, and paste to LINE / Threads.',
    'テンプレを選んでコピーし、LINE / Threads などに貼り付け'
  ),
  (
    'topic.share.template.normal',
    '這題怎麼看？\n「{{title}}」\n\n{{url}}',
    'topic',
    '分享文案：正常版',
    '這題怎麼看？\n「{{title}}」\n\n{{url}}',
    'What do you think?\n"{{title}}"\n\n{{url}}',
    'どう思う？\n「{{title}}」\n\n{{url}}'
  ),
  (
    'topic.share.template.help',
    '急！在線等！這題超難抉擇，大家會怎麼選？🤔\n「{{title}}」\n\n{{url}}',
    'topic',
    '分享文案：求救版',
    '急！在線等！這題超難抉擇，大家會怎麼選？🤔\n「{{title}}」\n\n{{url}}',
    'Help! Hard choice—what would you pick? 🤔\n"{{title}}"\n\n{{url}}',
    '急募！超難問い、みんなどうする？🤔\n「{{title}}」\n\n{{url}}'
  ),
  (
    'topic.share.template.challenge',
    '我覺得選這個穩贏，敢不敢來投票對決？😎\n「{{title}}」\n\n{{url}}',
    'topic',
    '分享文案：挑戰版',
    '我覺得選這個穩贏，敢不敢來投票對決？😎\n「{{title}}」\n\n{{url}}',
    'I know this side wins—dare to vote? 😎\n"{{title}}"\n\n{{url}}',
    'こっちが勝ちだと思う。対決しよ？😎\n「{{title}}」\n\n{{url}}'
  ),
  (
    'topic.share.template.chaos',
    '世界越快，心則慢... 拜託告訴我這題的正確答案是什麼🤯\n「{{title}}」\n\n{{url}}',
    'topic',
    '分享文案：混沌版',
    '世界越快，心則慢... 拜託告訴我這題的正確答案是什麼🤯\n「{{title}}」\n\n{{url}}',
    'Chaos everywhere—what''s the "right" answer? 🤯\n"{{title}}"\n\n{{url}}',
    '世は速いのに心は遅い…正解は？🤯\n「{{title}}」\n\n{{url}}'
  ),
  (
    'topic.share.templateLabel.normal',
    '正常',
    'topic',
    '分享模板按鈕：正常',
    '正常',
    'Neutral',
    '普通'
  ),
  (
    'topic.share.templateLabel.help',
    '求救',
    'topic',
    '分享模板按鈕：求救',
    '求救',
    'Help',
    '助けて'
  ),
  (
    'topic.share.templateLabel.challenge',
    '挑戰',
    'topic',
    '分享模板按鈕：挑戰',
    '挑戰',
    'Challenge',
    '挑戦'
  ),
  (
    'topic.share.templateLabel.chaos',
    '混沌',
    'topic',
    '分享模板按鈕：混沌',
    '混沌',
    'Chaos',
    '混沌'
  ),
  (
    'topic.share.toast.copiedTitle',
    '已複製',
    'topic',
    '複製成功 toast 標題',
    '已複製',
    'Copied',
    'コピーしました'
  ),
  (
    'topic.share.toast.copiedDesc',
    '請貼到 LINE / Threads 分享',
    'topic',
    '複製成功 toast 說明',
    '請貼到 LINE / Threads 分享',
    'Paste to LINE / Threads to share.',
    'LINE / Threads などに貼り付けてください'
  ),
  (
    'topic.share.completeButton',
    '我已分享完成',
    'topic',
    '分享對話框完成按鈕',
    '我已分享完成',
    'I''ve shared',
    'シェア完了'
  ),
  (
    'topic.share.completeSuccess',
    '已領取今日分享獎勵',
    'topic',
    '完成分享後成功 toast',
    '已領取今日分享獎勵',
    'Daily share reward claimed',
    '本日のシェア報酬を受け取りました'
  ),
  (
    'topic.share.loginRequired',
    '請先登入以領取分享獎勵',
    'topic',
    '未登入完成分享',
    '請先登入以領取分享獎勵',
    'Log in to claim the share reward.',
    '報酬を受け取るにはログインしてください'
  ),
  (
    'topic.share.clipboardError',
    '無法複製到剪貼簿',
    'topic',
    '剪貼簿失敗',
    '無法複製到剪貼簿',
    'Could not copy to clipboard',
    'クリップボードにコピーできませんでした'
  ),
  (
    'topic.share.button.aria',
    '分享主題',
    'topic',
    '主題卡片分享按鈕 aria-label',
    '分享主題',
    'Share topic',
    'トピックをシェア'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
