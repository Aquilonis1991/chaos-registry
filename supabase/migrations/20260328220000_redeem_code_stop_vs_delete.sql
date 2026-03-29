-- 停止：僅 is_active = false；刪除：自 redeem_codes 移除（兌換紀錄 CASCADE）

CREATE OR REPLACE FUNCTION public.admin_deactivate_redeem_code(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_n INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.redeem_codes
  SET is_active = false
  WHERE id = p_id AND is_active = true;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found_or_already_stopped');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_redeem_code(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_n INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.redeem_codes
  WHERE id = p_id;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_deactivate_redeem_code(uuid) IS '管理員：停用兌換碼（不可再兌換，紀錄仍保留）';
COMMENT ON FUNCTION public.admin_delete_redeem_code(uuid) IS '管理員：刪除兌換碼資料列（關聯兌換紀錄一併刪除）';

GRANT EXECUTE ON FUNCTION public.admin_deactivate_redeem_code(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES
  ('admin.redeemCodes.col.actions', '操作', 'admin', '後台兌換碼：操作欄', '操作', 'Actions', '操作'),
  ('admin.redeemCodes.stop', '停止', 'admin', '後台兌換碼：停止按鈕', '停止', 'Stop', '停止'),
  ('admin.redeemCodes.delete', '刪除', 'admin', '後台兌換碼：刪除按鈕', '刪除', 'Delete', '削除'),
  ('admin.redeemCodes.toast.stopOk', '已停止此兌換碼', 'admin', '', '已停止此兌換碼', 'Redeem code stopped', 'コードを停止しました'),
  ('admin.redeemCodes.toast.removeOk', '已刪除兌換碼', 'admin', '', '已刪除兌換碼', 'Redeem code removed', 'コードを削除しました'),
  ('admin.redeemCodes.confirmDeleteTitle', '確定刪除？', 'admin', '', '確定刪除？', 'Delete this code?', '削除しますか？'),
  ('admin.redeemCodes.confirmDeleteDesc', '將永久移除「{{code}}」與其兌換紀錄，無法復原。', 'admin', '', '將永久移除「{{code}}」與其兌換紀錄，無法復原。', 'This will permanently remove "{{code}}" and its redemption records.', '「{{code}}」と引き換え履歴を完全に削除します。元に戻せません。'),
  ('admin.redeemCodes.confirmDeleteConfirm', '確定刪除', 'admin', '', '確定刪除', 'Delete', '削除する')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();
