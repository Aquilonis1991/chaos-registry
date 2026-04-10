-- Root fix for new-user token grant consistency.
-- 1) Always use system_config.new_user_tokens (fallback 300)
-- 2) Generate deterministic non-duplicate fallback nickname
-- 3) Write signup token transaction for auditability

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
  -- Read initial token amount from system_config in a type-safe way.
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

  -- Safe default and floor.
  v_initial_tokens := GREATEST(COALESCE(v_initial_tokens, 300), 0);

  -- Build a stable short suffix from uid.
  v_suffix := UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 6));

  -- Resolve nickname from OAuth/user metadata.
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

  -- Ensure nickname uniqueness (even when provider returns duplicated names).
  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.nickname = v_nickname
      AND p.id <> NEW.id
  ) THEN
    v_nickname := LEFT(v_nickname, 43) || '_' || v_suffix;
  END IF;

  -- Avatar: allow simple emoji/text, reject URL as avatar content.
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

  -- Record initial token grant exactly once for traceability.
  IF v_inserted_rows > 0 AND v_initial_tokens > 0 THEN
    INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
    VALUES (NEW.id, v_initial_tokens, 'signup_bonus', 'New user initial token grant');
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block auth signup due to profile bootstrap edge cases.
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
