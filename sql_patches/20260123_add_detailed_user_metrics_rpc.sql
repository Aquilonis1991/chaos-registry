-- Create get_user_detailed_behavior RPC for AI implementation
-- Returns richer data including topic names and vote content
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
    WHERE created_by = p_user_id;

    -- 3. Activity Days
    SELECT COUNT(DISTINCT DATE(created_at)) INTO v_activity_days
    FROM votes
    WHERE user_id = p_user_id;

    -- Default Counters
    IF v_total_votes IS NULL THEN v_total_votes := 0; END IF;
    IF v_created_topics IS NULL THEN v_created_topics := 0; END IF;
    IF v_activity_days IS NULL THEN v_activity_days := 0; END IF;

    -- 4. Recent Created Topic Titles (Limit 20)
    SELECT jsonb_agg(title) INTO v_recent_topics
    FROM (
        SELECT title
        FROM topics
        WHERE created_by = p_user_id
        ORDER BY created_at DESC
        LIMIT 20
    ) t;

    -- 5. Recent Votes (Topic Title + Choice Content) (Limit 50)
    -- Joins votes -> topics AND votes -> topic_options (or logic to get option text)
    -- Assuming votes table has 'option_id' and 'topic_id'
    -- And we need to get the option text.
    -- Note: If option_id is 'option-1' or 'option-2', we need to fetch from topic JSON or separate table.
    -- Adjusting logic based on schema: topics table has 'options' JSONB column usually, or separate table?
    -- Based on previous analysis, topics has 'options' JSONB.
    
    SELECT jsonb_agg(
        jsonb_build_object(
            'topic', topic_title,
            'choice', choice_text
        )
    ) INTO v_recent_votes
    FROM (
        SELECT 
            t.title as topic_title,
            -- Extract option text from topic options array based on votes.option_id
            -- votes.option_id formats: "option-1", "option-2" (0-indexed or 1-indexed? usually ID in json)
            -- Let's attempt to find the matching option object in standard jsonb array
            (
                SELECT (opt ->> 'text')
                FROM jsonb_array_elements(t.options) opt
                WHERE (opt ->> 'id') = v.option_id
            ) as choice_text
        FROM votes v
        JOIN topics t ON v.topic_id = t.id
        WHERE v.user_id = p_user_id
        ORDER BY v.created_at DESC
        LIMIT 50
    ) v_data;

    -- Default Arrays
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
