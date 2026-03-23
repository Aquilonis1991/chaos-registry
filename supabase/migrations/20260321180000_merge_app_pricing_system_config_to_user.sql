-- 後台「系統配置」：將原 app、pricing 分類合併至 user（用戶配置）單一分頁

UPDATE public.system_config
SET category = 'user',
    updated_at = now()
WHERE category IN ('app', 'pricing');
