-- 兌換碼：代幣獎勵、有效期、全用戶共用總兌換上限（NULL 或 0＝無上限）、每用戶限兌一次
-- RPC：redeem_code（用戶）、admin_list/create/delete_redeem_code（管理員）

ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'ai_usage','create_topic','free_create_topic','cast_vote','cast_free_vote','free_vote',
    'watch_ad','click_native_ad','deposit','complete_mission','admin_adjustment','admin_grant',
    'extend_topic_duration','add_topic_option','arena_shield','purchase','refund','redeem_code'
  ));

CREATE TABLE IF NOT EXISTS public.redeem_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'tokens'
    CHECK (reward_type IN ('tokens')),
  token_amount INTEGER NOT NULL CHECK (token_amount > 0),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions >= 0),
  redemption_count INTEGER NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT redeem_codes_valid_range CHECK (valid_until >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_redeem_codes_code_active
  ON public.redeem_codes (code)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.redeem_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redeem_code_id UUID NOT NULL REFERENCES public.redeem_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (redeem_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_redeem_code_redemptions_user
  ON public.redeem_code_redemptions (user_id);

ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_code_redemptions ENABLE ROW LEVEL SECURITY;

-- 用戶兌換（SECURITY DEFINER）
CREATE OR REPLACE FUNCTION public.redeem_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_norm TEXT;
  v_row RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  v_norm := upper(btrim(COALESCE(p_code, '')));
  IF v_norm = '' OR length(v_norm) > 64 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  PERFORM public.check_general_rate_limit('api_general', 120);

  SELECT * INTO v_row
  FROM public.redeem_codes
  WHERE code = v_norm AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_row.valid_from > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_started');
  END IF;

  IF v_row.valid_until < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  IF v_row.max_redemptions IS NOT NULL AND v_row.max_redemptions > 0
     AND v_row.redemption_count >= v_row.max_redemptions THEN
    RETURN jsonb_build_object('success', false, 'error', 'exhausted');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.redeem_code_redemptions r
    WHERE r.redeem_code_id = v_row.id AND r.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  INSERT INTO public.redeem_code_redemptions (redeem_code_id, user_id)
  VALUES (v_row.id, v_uid);

  UPDATE public.redeem_codes
  SET redemption_count = redemption_count + 1
  WHERE id = v_row.id;

  PERFORM public.add_tokens(v_uid, v_row.token_amount);

  INSERT INTO public.token_transactions (
    user_id, amount, transaction_type, reference_id, description
  ) VALUES (
    v_uid,
    v_row.token_amount,
    'redeem_code',
    v_row.id,
    'redeem_code:' || v_row.code
  );

  RETURN jsonb_build_object(
    'success', true,
    'tokens_added', v_row.token_amount,
    'code', v_row.code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_redeem_codes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          c.id,
          c.code,
          c.reward_type,
          c.token_amount,
          c.valid_from,
          c.valid_until,
          c.max_redemptions,
          c.redemption_count,
          c.is_active,
          c.created_at,
          c.created_by
        FROM public.redeem_codes c
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_redeem_code(
  p_code text,
  p_token_amount integer,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_max_redemptions integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_norm TEXT;
  v_id UUID;
  v_max INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_norm := upper(btrim(COALESCE(p_code, '')));
  IF v_norm = '' OR length(v_norm) > 64 THEN
    RAISE EXCEPTION 'Invalid code';
  END IF;

  IF p_token_amount IS NULL OR p_token_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid token amount';
  END IF;

  IF p_valid_from IS NULL OR p_valid_until IS NULL OR p_valid_until < p_valid_from THEN
    RAISE EXCEPTION 'Invalid validity range';
  END IF;

  IF p_max_redemptions IS NOT NULL AND p_max_redemptions < 0 THEN
    RAISE EXCEPTION 'Invalid max redemptions';
  END IF;

  -- NULL 或 0：全用戶共用次數無上限（存成 NULL）
  v_max := CASE
    WHEN p_max_redemptions IS NULL OR p_max_redemptions = 0 THEN NULL
    ELSE p_max_redemptions
  END;

  IF EXISTS (
    SELECT 1 FROM public.redeem_codes c
    WHERE c.code = v_norm AND c.is_active = true
  ) THEN
    RAISE EXCEPTION 'Code already exists';
  END IF;

  INSERT INTO public.redeem_codes (
    code, reward_type, token_amount, valid_from, valid_until, max_redemptions, created_by
  ) VALUES (
    v_norm, 'tokens', p_token_amount, p_valid_from, p_valid_until, v_max, v_uid
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
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

  UPDATE public.redeem_codes
  SET is_active = false
  WHERE id = p_id;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON TABLE public.redeem_codes IS '行銷／活動兌換碼（目前僅支援代幣）';
COMMENT ON FUNCTION public.redeem_code(text) IS '用戶兌換；每碼每用戶僅一次';

GRANT EXECUTE ON FUNCTION public.redeem_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_redeem_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_redeem_code(text, integer, timestamptz, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_redeem_code(uuid) TO authenticated;

-- UI 文字（後台／個人頁／代幣紀錄）
INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES
  ('admin.tabs.redeemCodes', '兌換碼', 'admin', '後台分頁：兌換碼', '兌換碼', 'Redeem codes', '引き換えコード'),
  ('admin.redeemCodes.pageTitle', '兌換碼管理', 'admin', '兌換碼管理標題', '兌換碼管理', 'Redeem code management', '引き換えコード管理'),
  ('admin.redeemCodes.pageDesc', '新增活動兌換碼、設定代幣數量與可兌換期間。', 'admin', '兌換碼說明', '新增活動兌換碼、設定代幣數量與可兌換期間。', 'Create promotional codes with token rewards and validity windows.', 'キャンペーン用コードを追加し、トークン数と有効期間を設定します。'),
  ('admin.redeemCodes.col.code', '兌換碼', 'admin', '', '兌換碼', 'Code', 'コード'),
  ('admin.redeemCodes.col.reward', '品項', 'admin', '', '品項', 'Reward', '特典'),
  ('admin.redeemCodes.col.tokens', '代幣數量', 'admin', '', '代幣數量', 'Tokens', 'トークン数'),
  ('admin.redeemCodes.col.validFrom', '開始', 'admin', '', '開始', 'From', '開始'),
  ('admin.redeemCodes.col.validUntil', '結束', 'admin', '', '結束', 'Until', '終了'),
  ('admin.redeemCodes.col.maxRedemptions', '全用戶上限', 'admin', '', '全用戶上限', 'Shared cap', '全員上限'),
  ('admin.redeemCodes.col.redeemed', '已兌換', 'admin', '', '已兌換', 'Redeemed', '使用数'),
  ('admin.redeemCodes.col.status', '狀態', 'admin', '', '狀態', 'Status', '状態'),
  ('admin.redeemCodes.status.active', '啟用', 'admin', '', '啟用', 'Active', '有効'),
  ('admin.redeemCodes.status.inactive', '已停用', 'admin', '', '已停用', 'Inactive', '無効'),
  ('admin.redeemCodes.reward.tokens', '代幣', 'admin', '', '代幣', 'Tokens', 'トークン'),
  ('admin.redeemCodes.unlimited', '不限', 'admin', '', '不限', 'Unlimited', '無制限'),
  ('admin.redeemCodes.addButton', '新增兌換碼', 'admin', '', '新增兌換碼', 'Add code', 'コードを追加'),
  ('admin.redeemCodes.dialogTitle', '新增兌換碼', 'admin', '', '新增兌換碼', 'Add redeem code', '引き換えコードを追加'),
  ('admin.redeemCodes.form.code', '兌換碼', 'admin', '', '兌換碼', 'Code', 'コード'),
  ('admin.redeemCodes.form.tokenAmount', '代幣數量', 'admin', '', '代幣數量', 'Token amount', 'トークン数'),
  ('admin.redeemCodes.form.validFrom', '可兌換開始時間', 'admin', '', '可兌換開始時間', 'Valid from', '利用開始'),
  ('admin.redeemCodes.form.validUntil', '可兌換結束時間', 'admin', '', '可兌換結束時間', 'Valid until', '利用終了'),
  ('admin.redeemCodes.form.maxRedemptions', '全用戶共用兌換次數（選填）', 'admin', '', '全用戶共用兌換次數（選填）', 'Shared redemption cap (optional)', '全員共通の引き換え回数（任意）'),
  ('admin.redeemCodes.form.maxRedemptionsHint', '全用戶共用次數；留空或填 0 表示無上限', 'admin', '', '全用戶共用次數；留空或填 0 表示無上限', 'Shared cap across all users; leave empty or 0 for unlimited.', '全員共通の上限回数。空欄または0で無制限。'),
  ('admin.redeemCodes.submit', '建立', 'admin', '', '建立', 'Create', '作成'),
  ('admin.redeemCodes.cancel', '取消', 'admin', '', '取消', 'Cancel', 'キャンセル'),
  ('admin.redeemCodes.delete', '停用', 'admin', '', '停用', 'Deactivate', '無効化'),
  ('admin.redeemCodes.toast.createOk', '已建立兌換碼', 'admin', '', '已建立兌換碼', 'Redeem code created', 'コードを作成しました'),
  ('admin.redeemCodes.toast.deleteOk', '已停用兌換碼', 'admin', '', '已停用兌換碼', 'Redeem code deactivated', 'コードを無効化しました'),
  ('admin.redeemCodes.error.load', '載入兌換碼失敗', 'admin', '', '載入兌換碼失敗', 'Failed to load codes', '読み込みに失敗しました'),
  ('profile.menu.redeemCode', '兌換碼', 'profile', '個人頁選單', '兌換碼', 'Redeem code', '引き換えコード'),
  ('redeemCode.dialog.title', '兌換碼', 'redeem', '', '兌換碼', 'Redeem code', '引き換えコード'),
  ('redeemCode.dialog.description', '輸入活動兌換碼以領取代幣。', 'redeem', '', '輸入活動兌換碼以領取代幣。', 'Enter a code to claim tokens.', 'コードを入力してトークンを受け取ります。'),
  ('redeemCode.form.label', '兌換碼', 'redeem', '彈窗輸入欄標籤', '兌換碼', 'Code', 'コード'),
  ('redeemCode.form.placeholder', '請輸入兌換碼', 'redeem', '', '請輸入兌換碼', 'Enter code', 'コードを入力'),
  ('redeemCode.button.redeem', '兌換', 'redeem', '', '兌換', 'Redeem', '引き換える'),
  ('redeemCode.success.toast', '兌換成功', 'redeem', '', '兌換成功', 'Redeemed successfully', '引き換え成功'),
  ('redeemCode.success.tokensAdded', '已發放 {{amount}} 失序值', 'redeem', '', '已發放 {{amount}} 失序值', '{{amount}} tokens added', '{{amount}} トークンを付与しました'),
  ('redeemCode.error.not_authenticated', '請先登入', 'redeem', '', '請先登入', 'Please sign in', 'ログインしてください'),
  ('redeemCode.error.invalid_input', '請輸入有效兌換碼', 'redeem', '', '請輸入有效兌換碼', 'Enter a valid code', '有効なコードを入力してください'),
  ('redeemCode.error.not_found', '查無此兌換碼或已停用', 'redeem', '', '查無此兌換碼或已停用', 'Code not found or inactive', 'コードが見つからないか無効です'),
  ('redeemCode.error.not_started', '此兌換碼尚未開放', 'redeem', '', '此兌換碼尚未開放', 'This code is not active yet', 'まだ利用開始していません'),
  ('redeemCode.error.expired', '此兌換碼已過期', 'redeem', '', '此兌換碼已過期', 'This code has expired', '有効期限切れです'),
  ('redeemCode.error.exhausted', '此兌換碼已達兌換上限', 'redeem', '', '此兌換碼已達兌換上限', 'This code has reached its redemption limit', '利用上限に達しました'),
  ('redeemCode.error.already_redeemed', '您已兌換過此碼', 'redeem', '', '您已兌換過此碼', 'You already redeemed this code', '既に利用済みです'),
  ('redeemCode.error.generic', '兌換失敗，請稍後再試', 'redeem', '', '兌換失敗，請稍後再試', 'Redeem failed, try again later', '引き換えに失敗しました'),
  ('tokenHistory.type.redeemCode', '兌換碼', 'tokenHistory', '', '兌換碼', 'Redeem code', '引き換えコード'),
  ('tokenHistory.description.redeemCode', '兌換碼：{{code}}', 'tokenHistory', '', '兌換碼：{{code}}', 'Redeem code: {{code}}', '引き換え: {{code}}')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
