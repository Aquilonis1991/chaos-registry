-- 一次性建立 10～20 個測試主題（TEST01, TEST02, ...）
-- 前提：至少有一筆 profiles，會用「第一筆 profile.id」當 creator_id
-- 若要指定建立者，請把下方 (SELECT id FROM profiles LIMIT 1) 改成該使用者的 UUID

INSERT INTO public.topics (
  creator_id,
  title,
  description,
  options,
  tags,
  exposure_level,
  duration_days,
  end_at,
  status,
  approval_status
)
SELECT
  (SELECT id FROM public.profiles LIMIT 1),
  'TEST' || LPAD(i::text, 2, '0'),
  '測試主題 ' || i || ' 描述',
  ('[
    {"id":"opt-a","text":"選項A","votes":0},
    {"id":"opt-b","text":"選項B","votes":0}
  ]')::jsonb,
  ARRAY['測試'],
  'medium',
  7,
  now() + interval '7 days',
  'active',
  'approved'
FROM generate_series(1, 20) AS i;

-- 若只要 10 個，把上面 generate_series(1, 20) 改成 generate_series(1, 10)
-- 若只要 15 個，改成 generate_series(1, 15)
