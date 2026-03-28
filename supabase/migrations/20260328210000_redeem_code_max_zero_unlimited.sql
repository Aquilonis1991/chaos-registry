-- 全用戶共用兌換次數：max_redemptions 為 NULL 或 0 視為無上限；僅在 >0 時檢查 redemption_count

ALTER TABLE public.redeem_codes
  DROP CONSTRAINT IF EXISTS redeem_codes_max_redemptions_check;

ALTER TABLE public.redeem_codes
  ADD CONSTRAINT redeem_codes_max_redemptions_check
  CHECK (max_redemptions IS NULL OR max_redemptions >= 0);

UPDATE public.redeem_codes
SET max_redemptions = NULL
WHERE max_redemptions = 0;

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

INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES (
  'admin.redeemCodes.form.maxRedemptions',
  '全用戶共用兌換次數（選填）',
  'admin',
  '兌換碼表單：全用戶總次數',
  '全用戶共用兌換次數（選填）',
  'Shared redemption cap (optional)',
  '全員共通の引き換え回数（任意）'
),
(
  'admin.redeemCodes.form.maxRedemptionsHint',
  '全用戶共用次數；留空或填 0 表示無上限',
  'admin',
  '兌換碼總次數說明',
  '全用戶共用次數；留空或填 0 表示無上限',
  'Shared cap across all users; leave empty or 0 for unlimited.',
  '全員共通の上限回数。空欄または0で無制限。'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();

INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES (
  'admin.redeemCodes.col.maxRedemptions',
  '全用戶上限',
  'admin',
  '兌換碼列表欄位',
  '全用戶上限',
  'Shared cap',
  '全員上限'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
