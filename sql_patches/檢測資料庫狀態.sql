-- 匯出目前資料庫所有表格與欄位資訊，方便下載檢測
WITH table_info AS (
  SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    COALESCE(pg_catalog.col_description(
      format('%s.%s', c.table_schema, c.table_name)::regclass::oid,
      c.ordinal_position
    ), '') AS column_comment,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale
  FROM information_schema.columns c
  WHERE c.table_schema IN ('public', 'storage', 'auth')
  ORDER BY c.table_schema, c.table_name, c.ordinal_position
)
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  COALESCE(character_maximum_length::text, '') AS char_length,
  COALESCE(numeric_precision::text, '') AS numeric_precision,
  COALESCE(numeric_scale::text, '') AS numeric_scale,
  is_nullable,
  COALESCE(column_default, '') AS column_default,
  column_comment
FROM table_info;


