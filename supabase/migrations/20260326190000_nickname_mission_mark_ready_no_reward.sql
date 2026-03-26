-- Idempotent migration: mark nickname mission as "ready to claim" without granting tokens.
-- This supports product requirement: user must go to Mission page and click "claim" to receive reward.
-- Security note: This does NOT validate nickname_updated_at; it only prevents repeated marking from causing repeated rewards.

-- Ensure the mission row exists
INSERT INTO public.missions (id, name, condition, reward, limit_per_day)
VALUES ('nickname_editor', '形象更新', '成功修改一次暱稱', 20, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  condition = EXCLUDED.condition,
  reward = COALESCE(public.missions.reward, EXCLUDED.reward),
  limit_per_day = EXCLUDED.limit_per_day;

CREATE OR REPLACE FUNCTION public.mark_nickname_mission_ready()
RETURNS TABLE (success boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      RETURN QUERY SELECT false, '未登入'::text;
      RETURN;
    END IF;

    -- Upsert progress marker (completed stays false until user claims reward)
    INSERT INTO public.user_missions (user_id, mission_id, progress, completed, completed_at, last_completed_date)
    VALUES (v_user_id, 'nickname_editor', 100, false, NULL, NULL)
    ON CONFLICT (user_id, mission_id) DO UPDATE SET
      progress = GREATEST(public.user_missions.progress, 100),
      updated_at = now();

    RETURN QUERY SELECT true, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, ('資料庫錯誤：' || SQLERRM)::text;
  END;
END;
$$;

COMMENT ON FUNCTION public.mark_nickname_mission_ready IS '標記暱稱任務可領取（不發獎）；用於改名後引導使用者到任務頁點擊領取。';

REVOKE ALL ON FUNCTION public.mark_nickname_mission_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_nickname_mission_ready() TO authenticated;

-- Refresh Schema Cache (PostgREST)
NOTIFY pgrst, 'reload schema';

