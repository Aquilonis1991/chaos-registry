-- Idempotent migration: provide a dedicated RPC to grant the nickname mission reward at most once.
-- Rationale: some environments may not have nickname_updated_at trigger/column fully applied or cached yet.
-- Security note: This function intentionally does NOT validate nickname_updated_at; it only enforces "no duplicate reward".

-- Ensure the mission row exists (some environments may not have run the earlier migration).
INSERT INTO public.missions (id, name, condition, reward, limit_per_day)
VALUES ('nickname_editor', '形象更新', '成功修改一次暱稱', 20, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  condition = EXCLUDED.condition,
  reward = COALESCE(public.missions.reward, EXCLUDED.reward),
  limit_per_day = EXCLUDED.limit_per_day;

CREATE OR REPLACE FUNCTION public.complete_nickname_mission_once()
RETURNS TABLE (success boolean, reward integer, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_mission RECORD;
  v_user_mission RECORD;
  v_reward integer;
  v_today date;
BEGIN
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      RETURN QUERY SELECT false, 0, '未登入'::text;
      RETURN;
    END IF;

    SELECT * INTO v_mission FROM public.missions WHERE id = 'nickname_editor';
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 0, '任務不存在'::text;
      RETURN;
    END IF;

    v_today := CURRENT_DATE;
    v_reward := v_mission.reward;

    SELECT * INTO v_user_mission
    FROM public.user_missions
    WHERE user_id = v_user_id AND mission_id = 'nickname_editor'
    FOR UPDATE;

    IF FOUND AND v_user_mission.completed THEN
      RETURN QUERY SELECT false, 0, '任務已完成'::text;
      RETURN;
    END IF;

    IF v_user_mission IS NULL THEN
      INSERT INTO public.user_missions (user_id, mission_id, completed, completed_at, last_completed_date, progress)
      VALUES (v_user_id, 'nickname_editor', true, now(), v_today, 100);
    ELSE
      UPDATE public.user_missions
      SET completed = true, completed_at = now(), last_completed_date = v_today, progress = 100, updated_at = now()
      WHERE user_id = v_user_id AND mission_id = 'nickname_editor'
        AND completed = false;
      IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, '任務已完成'::text;
        RETURN;
      END IF;
    END IF;

    PERFORM public.add_tokens(v_user_id, v_reward);
    BEGIN
      INSERT INTO public.token_transactions (user_id, amount, transaction_type, description)
      VALUES (v_user_id, v_reward, 'complete_mission', '完成任務: ' || v_mission.name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN QUERY SELECT true, v_reward, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    -- Make failures visible to client to speed up diagnosis (no silent failures).
    RETURN QUERY SELECT false, 0, ('資料庫錯誤：' || SQLERRM)::text;
  END;
END;
$$;

COMMENT ON FUNCTION public.complete_nickname_mission_once IS '完成暱稱修改任務並發放代幣（最多一次；不驗證 nickname_updated_at）。';

-- Allow authenticated users to invoke the RPC.
REVOKE ALL ON FUNCTION public.complete_nickname_mission_once() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_nickname_mission_once() TO authenticated;

-- Refresh Schema Cache (PostgREST)
NOTIFY pgrst, 'reload schema';

