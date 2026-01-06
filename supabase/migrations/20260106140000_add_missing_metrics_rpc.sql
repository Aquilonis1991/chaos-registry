-- Create get_user_behavior_metrics RPC for AI implementation
DROP FUNCTION IF EXISTS get_user_behavior_metrics(uuid);

CREATE OR REPLACE FUNCTION get_user_behavior_metrics(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_votes INT;
    v_created_topics INT;
    v_activity_days INT;
BEGIN
    -- 1. Total Votes (from user_stats or count votes)
    SELECT COUNT(*) INTO v_total_votes
    FROM votes
    WHERE user_id = p_user_id;

    -- 2. Created Topics
    SELECT COUNT(*) INTO v_created_topics
    FROM topics
    WHERE created_by = p_user_id;

    -- 3. Activity Days (distinct valid days from votes or topics)
    -- Simple approximation: Last 30 days active count
    SELECT COUNT(DISTINCT DATE(created_at)) INTO v_activity_days
    FROM votes
    WHERE user_id = p_user_id;

    -- Default to 1 if no activity to avoid AI skew
    IF v_total_votes IS NULL THEN v_total_votes := 0; END IF;
    IF v_created_topics IS NULL THEN v_created_topics := 0; END IF;
    IF v_activity_days IS NULL THEN v_activity_days := 0; END IF;

    RETURN json_build_object(
        'total_votes', v_total_votes,
        'created_topics', v_created_topics,
        'activity_days', v_activity_days
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_behavior_metrics(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_behavior_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_behavior_metrics(UUID) TO anon;
