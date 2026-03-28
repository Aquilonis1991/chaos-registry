-- Check system_config values to debug daily login reward discrepancy
SELECT key, value 
FROM public.system_config 
WHERE key IN ('mission_daily_login_reward', 'mission_watch_ad_reward');
