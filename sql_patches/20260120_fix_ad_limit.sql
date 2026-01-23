-- Add last_ad_watch_date column to profiles table
-- This is used to track daily ad watch limits reliably, independent of login time.

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_ad_watch_date TIMESTAMP WITH TIME ZONE;

-- Comment on column
-- update or create the RPC function to handle daily reset logic on the server side
CREATE OR REPLACE FUNCTION increment_ad_watch_count(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_last_date DATE;
  v_today DATE;
  v_current_count INT;
BEGIN
  v_today := CURRENT_DATE;

  SELECT 
    last_ad_watch_date::DATE, 
    ad_watch_count 
  INTO 
    v_last_date, 
    v_current_count 
  FROM profiles 
  WHERE id = p_user_id;

  -- If last date is not today (or null), reset count to 1 (this is the first watch)
  IF v_last_date IS NULL OR v_last_date < v_today THEN
    UPDATE profiles 
    SET 
      ad_watch_count = 1,
      last_ad_watch_date = NOW()
    WHERE id = p_user_id;
  ELSE
    -- Otherwise increment
    UPDATE profiles 
    SET 
      ad_watch_count = ad_watch_count + 1,
      last_ad_watch_date = NOW()
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
