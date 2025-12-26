-- ========================================
-- Add Daily Topic Discount Eligibility Check
-- ========================================

-- Function to check if user has created a topic today
-- Returns TRUE if the user is eligible for the daily discount (has NOT created a topic today)
CREATE OR REPLACE FUNCTION public.check_daily_topic_eligibility(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if there are any topics created by this user today (server timezone, usually UTC)
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.topics
    WHERE creator_id = p_user_id
      AND created_at >= CURRENT_DATE
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.check_daily_topic_eligibility(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_daily_topic_eligibility(UUID) TO service_role;
