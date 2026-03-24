-- 後台 UI 文字管理：單項編輯改用 admin RPC（繞過 ui_texts RLS）

CREATE OR REPLACE FUNCTION public.admin_update_ui_text(
  p_id UUID,
  p_value TEXT,
  p_zh TEXT,
  p_en TEXT,
  p_ja TEXT,
  p_description TEXT,
  p_category TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_updated_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Permission denied: admin required';
  END IF;

  UPDATE public.ui_texts
  SET
    value = p_value,
    zh = p_zh,
    en = p_en,
    ja = p_ja,
    description = p_description,
    category = COALESCE(NULLIF(trim(COALESCE(p_category, '')), ''), category),
    updated_at = now()
  WHERE id = p_id
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'Update UI text failed or row not found';
  END IF;

  RETURN v_updated_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_ui_text(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
NOTIFY pgrst, 'reload schema';
