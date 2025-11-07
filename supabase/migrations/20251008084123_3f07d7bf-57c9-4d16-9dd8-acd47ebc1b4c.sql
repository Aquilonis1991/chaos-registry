-- Phase 2.1: Create atomic token operation functions

-- Function to atomically deduct tokens
CREATE OR REPLACE FUNCTION public.deduct_tokens(user_id uuid, token_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET tokens = tokens - token_amount
  WHERE id = user_id
  AND tokens >= token_amount;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient tokens or user not found';
  END IF;
END;
$$;

-- Function to atomically add tokens
CREATE OR REPLACE FUNCTION public.add_tokens(user_id uuid, token_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET tokens = tokens + token_amount
  WHERE id = user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;