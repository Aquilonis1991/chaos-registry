-- Admin topic update RPC used by TopicManager.
-- Allows admins to update topic content and optionally fix topic status.

CREATE OR REPLACE FUNCTION public.admin_update_topic(
  p_topic_id uuid,
  p_title text,
  p_description text,
  p_exposure_level text,
  p_duration_days integer,
  p_tags text[],
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_duration integer := COALESCE(p_duration_days, 1);
  v_status text := NULLIF(trim(COALESCE(p_status, '')), '');
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  IF p_topic_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'invalid topic id');
  END IF;

  IF v_duration < 1 OR v_duration > 30 THEN
    RETURN jsonb_build_object('success', false, 'message', 'duration_days must be between 1 and 30');
  END IF;

  IF p_exposure_level NOT IN ('normal', 'medium', 'high') THEN
    RETURN jsonb_build_object('success', false, 'message', 'invalid exposure level');
  END IF;

  IF v_status IS NOT NULL AND v_status NOT IN ('active', 'ended', 'reported') THEN
    RETURN jsonb_build_object('success', false, 'message', 'invalid status');
  END IF;

  UPDATE public.topics
  SET
    title = COALESCE(NULLIF(trim(p_title), ''), title),
    description = COALESCE(p_description, description),
    exposure_level = p_exposure_level,
    duration_days = v_duration,
    tags = COALESCE(p_tags, tags),
    status = COALESCE(v_status, status),
    -- Keep end_at coherent with current duration from now.
    end_at = now() + make_interval(days => v_duration),
    updated_at = now()
  WHERE id = p_topic_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'topic not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_topic(uuid, text, text, text, integer, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_topic(uuid, text, text, text, integer, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_topic(uuid, text, text, text, integer, text[], text) TO service_role;

NOTIFY pgrst, 'reload schema';

