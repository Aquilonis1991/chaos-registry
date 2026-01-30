
-- Check what keys exist related to login reward
SELECT key, value, jsonb_typeof(value) as type 
FROM system_config 
WHERE key LIKE '%daily_login%' OR key LIKE '%reward%';

-- Insert the correct config if it's missing (idempotent)
INSERT INTO system_config (key, value, category, description)
VALUES ('mission_daily_login_reward', '5'::jsonb, 'mission', '每日簽到獎勵')
ON CONFLICT (key) DO UPDATE 
SET value = '5'::jsonb;
