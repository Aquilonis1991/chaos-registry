-- Force end the most recently created active topic for testing
WITH latest_topic AS (
  SELECT id 
  FROM public.topics 
  WHERE status = 'active' 
  ORDER BY created_at DESC 
  LIMIT 1
)
UPDATE public.topics
SET 
  status = 'ended',
  end_at = NOW() - INTERVAL '1 hour'
WHERE id = (SELECT id FROM latest_topic);

-- Verify the update
SELECT id, title, status, end_at FROM public.topics WHERE status = 'ended' ORDER BY end_at DESC LIMIT 1;
