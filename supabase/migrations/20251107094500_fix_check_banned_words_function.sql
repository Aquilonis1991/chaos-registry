-- Fix ambiguous column references in check_banned_words function
DROP FUNCTION IF EXISTS public.check_banned_words(text, text[]);

CREATE OR REPLACE FUNCTION public.check_banned_words(
  p_text text,
  p_check_levels text[] DEFAULT ARRAY['A','B','C','D','E']
)
RETURNS TABLE (
  found boolean,
  level text,
  keyword text,
  action text,
  category text,
  error_message text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE,
    bw.level,
    bw.keyword,
    bw.action,
    bw.category,
    format('內容包含禁字：%s', bw.keyword)
  FROM public.banned_words AS bw
  WHERE bw.is_active = TRUE
    AND bw.keyword IS NOT NULL
    AND bw.level = ANY(p_check_levels)
    AND POSITION(lower(bw.keyword) IN lower(p_text)) > 0
  ORDER BY array_position(p_check_levels, bw.level), bw.keyword
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL, NULL, NULL, NULL, NULL;
  END IF;
END;
$$;


