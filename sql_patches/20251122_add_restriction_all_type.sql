-- ========================================
-- 20251122 - 用戶限制新增「全部」類型
-- ========================================

BEGIN;

-- 1. 更新 user_restrictions 的限制類型檢查
ALTER TABLE public.user_restrictions
  DROP CONSTRAINT IF EXISTS user_restrictions_restriction_type_check;

ALTER TABLE public.user_restrictions
  ADD CONSTRAINT user_restrictions_restriction_type_check CHECK (
    restriction_type IN (
      'create_topic',
      'vote',
      'complete_mission',
      'modify_name',
      'recharge',
      'all'
    )
  );

-- 2. 更新檢查函式：若存在「全部」限制也一併阻擋
DROP FUNCTION IF EXISTS public.check_user_restriction(uuid, text);

CREATE OR REPLACE FUNCTION public.check_user_restriction(
  p_user_id UUID,
  p_restriction_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restricted BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_restrictions
    WHERE user_id = p_user_id
      AND restriction_type IN (p_restriction_type, 'all')
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_restricted;

  RETURN v_restricted;
END;
$$;

COMMIT;

