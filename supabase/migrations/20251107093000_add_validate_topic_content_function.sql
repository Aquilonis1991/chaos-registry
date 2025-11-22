-- Drop existing function (if any) to avoid signature conflicts
DROP FUNCTION IF EXISTS public.validate_topic_content(text, text, jsonb, text[], text, text[]);
CREATE OR REPLACE FUNCTION public.validate_topic_content(
  p_title text,
  p_description text DEFAULT NULL,
  p_options jsonb DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_check_levels text[] DEFAULT ARRAY['A','B','C','D','E', 'F']
)
RETURNS TABLE (
  is_valid boolean,
  matched_level text,
  matched_keyword text,
  matched_action text,
  field_name text,
  error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_match RECORD;
BEGIN
  WITH candidate_texts AS (
    SELECT 'title' AS field, p_title AS content
    UNION ALL
    SELECT 'description', p_description
    UNION ALL
    SELECT 'category', p_category
    UNION ALL
    SELECT 'option', elem
    FROM (
      SELECT jsonb_array_elements_text(p_options) AS elem
    ) AS opt
    UNION ALL
    SELECT 'tag', unnest(p_tags)
  ),
  active_words AS (
    SELECT keyword, level, action
    FROM banned_words
    WHERE is_active = true
      AND keyword IS NOT NULL
      AND level = ANY(p_check_levels)
  )
  SELECT ct.field, aw.keyword, aw.level, aw.action
  INTO v_match
  FROM candidate_texts ct
  JOIN active_words aw
    ON ct.content IS NOT NULL
   AND ct.content <> ''
   AND POSITION(lower(aw.keyword) IN lower(ct.content)) > 0
  ORDER BY array_position(p_check_levels, aw.level), aw.keyword
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      false,
      v_match.level,
      v_match.keyword,
      v_match.action,
      v_match.field,
      format('欄位 %s 含禁字：%s', v_match.field, v_match.keyword);
  ELSE
    RETURN QUERY
    SELECT
      true,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL;
  END IF;
END;
$$;

-- Create or replace function to validate topic content against banned words
CREATE OR REPLACE FUNCTION public.validate_topic_content(
  p_title text,
  p_description text DEFAULT NULL,
  p_options jsonb DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_check_levels text[] DEFAULT ARRAY['A','B','C','D','E']
)
RETURNS TABLE (
  is_valid boolean,
  matched_level text,
  matched_keyword text,
  matched_action text,
  field_name text,
  error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_match RECORD;
BEGIN
  WITH candidate_texts AS (
    SELECT 'title' AS field, p_title AS content
    UNION ALL
    SELECT 'description', p_description
    UNION ALL
    SELECT 'category', p_category
    UNION ALL
    SELECT 'option', elem
    FROM (
      SELECT jsonb_array_elements_text(p_options) AS elem
    ) AS opt
    UNION ALL
    SELECT 'tag', unnest(p_tags)
  ),
  active_words AS (
    SELECT keyword, level, action
    FROM banned_words
    WHERE is_active = true
      AND keyword IS NOT NULL
      AND level = ANY(p_check_levels)
  )
  SELECT ct.field, aw.keyword, aw.level, aw.action
  INTO v_match
  FROM candidate_texts ct
  JOIN active_words aw
    ON ct.content IS NOT NULL
   AND ct.content <> ''
   AND POSITION(lower(aw.keyword) IN lower(ct.content)) > 0
  ORDER BY array_position(p_check_levels, aw.level), aw.keyword
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      false,
      v_match.level,
      v_match.keyword,
      v_match.action,
      v_match.field,
      format('欄位 %s 含禁字：%s', v_match.field, v_match.keyword);
  ELSE
    RETURN QUERY
    SELECT
      true,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL;
  END IF;
END;
$$;

