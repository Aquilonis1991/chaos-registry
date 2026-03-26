-- Hot path performance indexes for single-maintainer scaling
-- Target: user-centric timelines and history queries at higher DAU.

-- Notifications page:
-- WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at_desc
  ON public.notifications (user_id, created_at DESC);

-- Token history:
-- WHERE user_id = ? ORDER BY created_at DESC LIMIT N
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_created_at_desc
  ON public.token_transactions (user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';

