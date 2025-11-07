-- Update handle_new_user function to use dynamic config
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  initial_tokens integer;
BEGIN
  -- Get initial token amount from system config
  SELECT (value::text)::integer INTO initial_tokens
  FROM public.system_config
  WHERE key = 'new_user_tokens';
  
  -- Fallback to 50 if config not found
  IF initial_tokens IS NULL THEN
    initial_tokens := 50;
  END IF;
  
  INSERT INTO public.profiles (id, nickname, avatar, tokens)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'avatar', '🔥'),
    initial_tokens
  );
  RETURN NEW;
END;
$$;