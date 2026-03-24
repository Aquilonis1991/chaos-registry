-- 將 option_item_max_length 歸入「驗證限制」(validation)，與後台 SystemConfigManager 分頁一致
-- 若曾以 topic_limits 等舊分類寫入，一併改為 validation

UPDATE public.system_config
SET category = 'validation',
    updated_at = now()
WHERE key = 'option_item_max_length';
