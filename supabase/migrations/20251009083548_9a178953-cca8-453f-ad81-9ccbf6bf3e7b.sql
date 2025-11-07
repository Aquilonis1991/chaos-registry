
-- Fix the function search path warning
CREATE OR REPLACE FUNCTION public.validate_text_length(text_value text, min_length int, max_length int, field_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF text_value IS NULL OR length(trim(text_value)) < min_length THEN
    RAISE EXCEPTION '% must be at least % characters', field_name, min_length;
  END IF;
  
  IF length(text_value) > max_length THEN
    RAISE EXCEPTION '% must not exceed % characters', field_name, max_length;
  END IF;
  
  RETURN true;
END;
$$;
