-- 提供前端顯示「最新價格/上限」用的 quote RPC（避免前端直接讀 system_config）
CREATE OR REPLACE FUNCTION public.get_topic_influence_quote(
  p_topic_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic RECORD;
  v_res JSONB;
BEGIN
  PERFORM public.check_general_rate_limit('api_general', 120);

  SELECT id, allow_time_extension, allow_option_addition, extension_count, max_extension_count, end_at, status
  INTO v_topic
  FROM public.topics
  WHERE id = p_topic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  v_res := jsonb_build_object(
    'topic', jsonb_build_object(
      'id', v_topic.id,
      'status', v_topic.status,
      'end_at', v_topic.end_at,
      'allow_time_extension', COALESCE(v_topic.allow_time_extension, false),
      'allow_option_addition', COALESCE(v_topic.allow_option_addition, false),
      'extension_count', COALESCE(v_topic.extension_count, 0),
      'max_extension_count', COALESCE(v_topic.max_extension_count, 3)
    ),
    'costs', jsonb_build_object(
      'extend_1_day', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'extend_topic_1_day_cost' LIMIT 1), 0),
      'extend_2_day', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'extend_topic_2_day_cost' LIMIT 1), 0),
      'extend_3_day', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'extend_topic_3_day_cost' LIMIT 1), 0),
      'add_option',   COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'add_topic_option_cost' LIMIT 1), 0)
    ),
    'limits', jsonb_build_object(
      'time_extension_max_per_topic', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'topic_time_extension_max_per_topic' LIMIT 1), 3),
      'time_extension_only_when_remaining_hours_leq', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'topic_time_extension_only_when_remaining_hours_leq' LIMIT 1), 48),
      'time_extension_max_days_per_action', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'topic_time_extension_max_days_per_action' LIMIT 1), 3),
      'time_extension_max_per_user', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'topic_time_extension_max_per_user' LIMIT 1), 1),
      'option_add_max_per_topic', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'topic_option_add_max_per_topic' LIMIT 1), 5),
      'option_add_max_per_user', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'topic_option_add_max_per_user' LIMIT 1), 1),
      'option_add_min_length', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'topic_option_add_min_length' LIMIT 1), 2),
      'option_add_max_length', COALESCE((SELECT (value #>> '{}')::INT FROM public.system_config WHERE key = 'topic_option_add_max_length' LIMIT 1), 20)
    )
  );

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_topic_influence_quote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_topic_influence_quote(UUID) TO anon;

NOTIFY pgrst, 'reload schema';

