-- Update default tokens for new users from 1250 to 50
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, avatar, tokens)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'avatar', '🔥'),
    50
  );
  RETURN NEW;
END;
$$;

-- Update default value in profiles table
ALTER TABLE public.profiles ALTER COLUMN tokens SET DEFAULT 50;