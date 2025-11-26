-- Backfill missing cast_vote transactions based on current votes table amounts.
-- This script is idempotent: it only inserts the delta between votes.amount and existing cast_vote transactions.
WITH vote_totals AS (
  SELECT user_id, topic_id, COALESCE(amount, 0) AS vote_amount
  FROM public.votes
  WHERE amount IS NOT NULL AND amount > 0
),
transaction_totals AS (
  SELECT user_id, reference_id AS topic_id, SUM(ABS(amount)) AS token_spent
  FROM public.token_transactions
  WHERE transaction_type = 'cast_vote'
  GROUP BY user_id, reference_id
),
missing AS (
  SELECT
    vt.user_id,
    vt.topic_id,
    vt.vote_amount - COALESCE(tt.token_spent, 0) AS missing_amount
  FROM vote_totals vt
  LEFT JOIN transaction_totals tt
    ON tt.user_id = vt.user_id AND tt.topic_id = vt.topic_id
)
INSERT INTO public.token_transactions (user_id, amount, transaction_type, reference_id, description)
SELECT
  user_id,
  -missing_amount,
  'cast_vote',
  topic_id,
  'Backfill: reconcile cast_vote tokens from votes table'
FROM missing
WHERE missing_amount > 0;

