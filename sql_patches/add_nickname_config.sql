-- Add Nickname Banned Levels Config

INSERT INTO public.system_config (key, value, category, description)
VALUES 
  ('nickname_banned_check_levels', '["A","B","C","D","E"]'::jsonb, 'validation', '暱稱禁字檢查等級 (A-E)')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, description = EXCLUDED.description;
