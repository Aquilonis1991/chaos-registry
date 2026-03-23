-- 統一 topics.exposure_level 為 normal / medium / high（與前端、system_config exposure_costs 一致）
--
-- 歷史原因：
-- - 建表時內嵌 CHECK 名為 topics_exposure_level_check，允許 normal|medium|high
-- - 後續 migration 曾新增 check_exposure_level 為 low|medium|high，若兩者並存會導致只能寫 medium/high
-- - 先前應用曾將 normal 對應為 low 寫入，會違反 topics_exposure_level_check
--
-- 作法：移除所有相關 CHECK、收斂資料、再建立單一約束

ALTER TABLE public.topics DROP CONSTRAINT IF EXISTS topics_exposure_level_check;
ALTER TABLE public.topics DROP CONSTRAINT IF EXISTS check_exposure_level;

-- 舊鍵 low 視為與 normal 同階
UPDATE public.topics
SET exposure_level = 'normal'
WHERE exposure_level = 'low';

-- 其餘非法值收斂（與舊 migration 邏輯一致：改為 medium）
UPDATE public.topics
SET exposure_level = 'medium'
WHERE exposure_level IS NOT NULL
  AND exposure_level NOT IN ('normal', 'medium', 'high');

ALTER TABLE public.topics
  ADD CONSTRAINT topics_exposure_level_check
  CHECK (exposure_level IN ('normal', 'medium', 'high'));
