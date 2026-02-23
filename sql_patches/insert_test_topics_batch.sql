-- 一次性建立測試用主題 TEST01, TEST02, TEST03, ...
-- 使用前請將下方的「測試筆數」與「建立者 ID」改為實際值；建立者 ID 可從 profiles 表任選一筆。

DO $$
DECLARE
  -- 要建立幾筆（可改為 5, 10, 20 等）
  num_topics INT := 10;
  -- 建立者：取第一個 profile（若有指定測試用帳號可改為固定 UUID）
  creator_uuid UUID := (SELECT id FROM public.profiles LIMIT 1);
BEGIN
  IF creator_uuid IS NULL THEN
    RAISE EXCEPTION 'profiles 表為空，請先有至少一筆使用者再執行';
  END IF;

  -- 插入主題（建立者已寫入 topics.creator_id，無需 topic_creators 表）
  INSERT INTO public.topics (
    title,
    description,
    options,
    tags,
    creator_id,
    exposure_level,
    duration_days,
    end_at,
    status,
    approval_status,
    votes
  )
  SELECT
    'TEST' || LPAD(s.n::text, 2, '0'),
    '測試用主題 #' || s.n,
    '[
      {"id":"option-0","text":"選項A","votes":0},
      {"id":"option-1","text":"選項B","votes":0},
      {"id":"option-2","text":"選項C","votes":0}
    ]'::jsonb,
    ARRAY['測試'],
    creator_uuid,
    'normal',
    7,
    now() + interval '7 days',
    'active',
    'approved',
    '{}'::jsonb
  FROM (SELECT generate_series(1, num_topics) AS n) s;

  RAISE NOTICE '已建立 % 筆測試主題 (TEST01 ~ TEST%)，建立者: %', num_topics, LPAD(num_topics::text, 2, '0'), creator_uuid;
END $$;
