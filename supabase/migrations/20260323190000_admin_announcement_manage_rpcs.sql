-- 後台公告管理：使用 SECURITY DEFINER RPC，避免前端直接 INSERT/UPDATE/DELETE 在 RLS 邊界下出現「看似成功但未生效」

CREATE OR REPLACE FUNCTION public.admin_create_announcement(
  p_title TEXT,
  p_content TEXT,
  p_summary TEXT,
  p_image_url TEXT,
  p_priority INTEGER,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_is_active BOOLEAN,
  p_announcement_category TEXT,
  p_style_preset SMALLINT,
  p_display_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_created_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Permission denied: admin required';
  END IF;

  INSERT INTO public.announcements (
    title, content, summary, image_url, priority,
    start_date, end_date, is_active,
    announcement_category, style_preset, display_date,
    created_by
  ) VALUES (
    p_title, p_content, p_summary, p_image_url, p_priority,
    p_start_date, p_end_date, p_is_active,
    p_announcement_category, p_style_preset, p_display_date,
    v_uid
  )
  RETURNING id INTO v_created_id;

  IF v_created_id IS NULL THEN
    RAISE EXCEPTION 'Create announcement failed';
  END IF;

  RETURN v_created_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_announcement(
  p_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_summary TEXT,
  p_image_url TEXT,
  p_priority INTEGER,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_is_active BOOLEAN,
  p_announcement_category TEXT,
  p_style_preset SMALLINT,
  p_display_date DATE
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

  UPDATE public.announcements
  SET
    title = p_title,
    content = p_content,
    summary = p_summary,
    image_url = p_image_url,
    priority = p_priority,
    start_date = p_start_date,
    end_date = p_end_date,
    is_active = p_is_active,
    announcement_category = p_announcement_category,
    style_preset = p_style_preset,
    display_date = p_display_date,
    updated_at = now()
  WHERE id = p_id
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;

  RETURN v_updated_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_announcement_active(
  p_id UUID,
  p_is_active BOOLEAN
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

  UPDATE public.announcements
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_id
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;

  RETURN v_updated_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_announcement(
  p_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_deleted_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Permission denied: admin required';
  END IF;

  DELETE FROM public.announcements
  WHERE id = p_id
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS NULL THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;

  RETURN v_deleted_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_announcement(
  UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT, SMALLINT, DATE
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_create_announcement(
  TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, TEXT, SMALLINT, DATE
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_toggle_announcement_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_announcement(UUID) TO authenticated;
