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
