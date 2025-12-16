-- 修復 update_system_config 函數中 id 欄位/變數名稱衝突問題
DROP FUNCTION IF EXISTS public.update_system_config(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.update_system_config(
  p_config_id uuid,
  p_new_value jsonb
)
RETURNS TABLE (
  id uuid,
  key text,
  value jsonb,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_key text;
  v_value jsonb;
  v_updated_at timestamptz;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '權限不足：只有管理員可以更新系統配置';
  END IF;

  UPDATE public.system_config sc
  SET 
    value = p_new_value,
    updated_at = now()
  WHERE sc.id = p_config_id
  RETURNING 
    sc.id,
    sc.key,
    sc.value,
    sc.updated_at
  INTO 
    v_id,
    v_key,
    v_value,
    v_updated_at;

  IF v_id IS NULL THEN
    RAISE EXCEPTION '找不到指定的配置項';
  END IF;

  id := v_id;
  key := v_key;
  value := v_value;
  updated_at := v_updated_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_system_config(uuid, jsonb) TO authenticated;




