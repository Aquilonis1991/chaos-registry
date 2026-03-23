-- 將 option_item_max_length 歸入「投票配置」(voting)
-- 讓後台 SystemConfigManager 顯示於「投票配置」分頁

UPDATE public.system_config
SET category = 'voting',
    updated_at = now()
WHERE key = 'option_item_max_length';
