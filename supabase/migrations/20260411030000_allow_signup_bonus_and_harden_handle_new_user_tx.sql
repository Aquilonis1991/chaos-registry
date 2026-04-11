-- 1) Allow signup_bonus in token_transactions check (handle_new_user uses it).
-- 2) Isolate signup token log insert so FK/check issues never abort signup or confuse delete flows.

ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'ai_usage',
    'create_topic',
    'free_create_topic',
    'cast_vote',
    'cast_free_vote',
    'free_vote',
    'watch_ad',
    'click_native_ad',
    'deposit',
    'complete_mission',
    'admin_adjustment',
    'admin_grant',
    'extend_topic_duration',
    'add_topic_option',
    'arena_shield',
    'purchase',
    'refund',
    'redeem_code',
    'signup_bonus'
  ));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_initial_tokens integer;
  v_raw_nickname text;
  v_nickname text;
  v_avatar text;
  v_suffix text;
  v_inserted_rows integer := 0;
BEGIN
  SELECT
    CASE
      WHEN jsonb_typeof(sc.value) = 'number' THEN (sc.value::text)::integer
      WHEN jsonb_typeof(sc.value) = 'string'
           AND btrim(sc.value::text, '"') ~ '^-?[0-9]+$'
        THEN (btrim(sc.value::text, '"'))::integer
      ELSE NULL
    END
  INTO v_initial_tokens
  FROM public.system_config sc
  WHERE sc.key = 'new_user_tokens'
  LIMIT 1;

  v_initial_tokens := GREATEST(COALESCE(v_initial_tokens, 300), 0);

  v_suffix := UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 6));

  v_raw_nickname := COALESCE(
    NEW.raw_user_meta_data->>'nickname',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'username',
    ''
  );
  v_raw_nickname := BTRIM(REGEXP_REPLACE(v_raw_nickname, '\s+', ' ', 'g'));

  IF v_raw_nickname = '' THEN
    v_nickname := 'User' || v_suffix;
  ELSE
    v_nickname := LEFT(v_raw_nickname, 50);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.nickname = v_nickname
      AND p.id <> NEW.id
  ) THEN
    v_nickname := LEFT(v_nickname, 43) || '_' || v_suffix;
  END IF;

  v_avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar', ''),
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', ''),
    NULLIF(NEW.raw_user_meta_data->>'photo_url', ''),
    '🔥'
  );
  IF v_avatar LIKE 'http://%' OR v_avatar LIKE 'https://%' THEN
    v_avatar := '🔥';
  END IF;
  v_avatar := LEFT(BTRIM(v_avatar), 10);
  IF v_avatar = '' THEN
    v_avatar := '🔥';
  END IF;

  INSERT INTO public.profiles (id, nickname, avatar, tokens)
  VALUES (NEW.id, v_nickname, v_avatar, v_initial_tokens)
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;

  IF v_inserted_rows > 0 AND v_initial_tokens > 0 THEN
    BEGIN
      INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
      VALUES (NEW.id, v_initial_tokens, 'signup_bonus', 'New user initial token grant');
    EXCEPTION
      WHEN OTHERS THEN
        -- Do not block auth signup / trigger if log row cannot be written (FK, RLS edge cases, etc.)
        NULL;
    END;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
