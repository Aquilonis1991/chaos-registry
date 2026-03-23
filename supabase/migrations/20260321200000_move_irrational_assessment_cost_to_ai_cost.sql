-- 將 irrational_assessment_cost 併入 ai_cost 分類
-- 後台 SystemConfigManager 以「AI 成本」分頁顯示

UPDATE public.system_config
SET category = 'ai_cost',
    updated_at = now()
WHERE key = 'irrational_assessment_cost';
