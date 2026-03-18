-- 修正 get_user_detailed_behavior：votes 表欄位為 option 非 option_id，且選項需支援 id 與 option-0 格式
DROP FUNCTION IF EXISTS get_user_detailed_behavior(uuid);

CREATE OR REPLACE FUNCTION get_user_detailed_behavior(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_votes INT;
    v_created_topics INT;
    v_activity_days INT;
    v_recent_topics JSONB;
    v_recent_votes JSONB;
BEGIN
    -- 1. Total Votes
    SELECT COUNT(*) INTO v_total_votes
    FROM votes
    WHERE user_id = p_user_id;

    -- 2. Created Topics Count
    SELECT COUNT(*) INTO v_created_topics
    FROM topics
    WHERE creator_id = p_user_id;

    -- 3. Activity Days
    SELECT COUNT(DISTINCT DATE(created_at)) INTO v_activity_days
    FROM votes
    WHERE user_id = p_user_id;

    IF v_total_votes IS NULL THEN v_total_votes := 0; END IF;
    IF v_created_topics IS NULL THEN v_created_topics := 0; END IF;
    IF v_activity_days IS NULL THEN v_activity_days := 0; END IF;

    -- 4. Recent Created Topic Titles (主題名稱，最多 20 筆)
    SELECT jsonb_agg(title) INTO v_recent_topics
    FROM (
        SELECT title
        FROM topics
        WHERE creator_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 20
    ) t;

    -- 5. Recent Votes：主題標題 + 使用者選擇的選項文字（votes 表欄位為 option，對應 options[].id 或 option-0）
    SELECT jsonb_agg(
        jsonb_build_object(
            'topic', topic_title,
            'choice', choice_text
        )
    ) INTO v_recent_votes
    FROM (
        SELECT
            t.title AS topic_title,
            (
                SELECT COALESCE(elem->>'text', elem->>'label', '')
                FROM jsonb_array_elements(t.options) WITH ORDINALITY AS arr(elem, idx)
                WHERE (elem->>'id') = v.option
                   OR ((elem->>'id') IS NULL AND v.option = 'option-' || (idx - 1)::text)
                LIMIT 1
            ) AS choice_text
        FROM votes v
        JOIN topics t ON v.topic_id = t.id
        WHERE v.user_id = p_user_id
        ORDER BY v.created_at DESC
        LIMIT 50
    ) v_data;

    IF v_recent_topics IS NULL THEN v_recent_topics := '[]'::jsonb; END IF;
    IF v_recent_votes IS NULL THEN v_recent_votes := '[]'::jsonb; END IF;

    RETURN json_build_object(
        'total_votes', v_total_votes,
        'created_topics', v_created_topics,
        'activity_days', v_activity_days,
        'recent_created_topics', v_recent_topics,
        'recent_votes', v_recent_votes
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_detailed_behavior(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_detailed_behavior(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_detailed_behavior(UUID) TO anon;

COMMENT ON FUNCTION get_user_detailed_behavior(UUID) IS '不理性鑑定用：回傳用戶投票數、建立主題數、活躍天數、最近建立的主題名稱、最近投票的主題+選項文字';
