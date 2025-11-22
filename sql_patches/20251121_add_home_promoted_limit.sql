-- ========================================
-- 20251121 - 新增首頁推廣主題數量配置
-- ========================================

DO $$
BEGIN
  -- 首頁推廣主題數量
  IF NOT EXISTS (
    SELECT 1 FROM public.system_config WHERE key = 'home_promoted_limit'
  ) THEN
    INSERT INTO public.system_config (key, value, category, description)
    VALUES (
      'home_promoted_limit',
      to_jsonb(30),
      'home',
      '首頁推廣主題區一次顯示的主題數量'
    );
  END IF;

  -- 全平台曝光名額限制
  IF NOT EXISTS (
    SELECT 1 FROM public.system_config WHERE key = 'home_exposure_global_limit_normal'
  ) THEN
    INSERT INTO public.system_config (key, value, category, description)
    VALUES (
      'home_exposure_global_limit_normal',
      to_jsonb(0),
      'home',
      '普通曝光每日全平台名額（0 代表無上限）'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.system_config WHERE key = 'home_exposure_global_limit_medium'
  ) THEN
    INSERT INTO public.system_config (key, value, category, description)
    VALUES (
      'home_exposure_global_limit_medium',
      to_jsonb(300),
      'home',
      '中等曝光每日全平台名額'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.system_config WHERE key = 'home_exposure_global_limit_high'
  ) THEN
    INSERT INTO public.system_config (key, value, category, description)
    VALUES (
      'home_exposure_global_limit_high',
      to_jsonb(100),
      'home',
      '高度曝光每日全平台名額'
    );
  END IF;

  -- 截止後主題保留天數
  IF NOT EXISTS (
    SELECT 1 FROM public.system_config WHERE key = 'home_expired_topic_grace_days'
  ) THEN
    INSERT INTO public.system_config (key, value, category, description)
    VALUES (
      'home_expired_topic_grace_days',
      to_jsonb(3),
      'home',
      '主題截止後仍保留在首頁列表的天數'
    );
  END IF;

  -- 同步 exposure_limits 表中的預設每日全平台名額
  UPDATE public.exposure_limits
  SET daily_global_limit = CASE exposure_level
    WHEN 'normal' THEN 0
    WHEN 'medium' THEN 300
    WHEN 'high' THEN 100
    ELSE daily_global_limit
  END,
      updated_at = now()
  WHERE exposure_level IN ('normal', 'medium', 'high');
END $$;

