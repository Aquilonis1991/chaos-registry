-- 1. Update token_transactions check constraint to include 'ai_usage'
ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'create_topic',
    'free_create_topic',
    'cast_vote',
    'cast_free_vote',
    'free_vote',
    'watch_ad',
    'complete_mission',
    'admin_adjustment',
    'purchase',
    'refund',
    'ai_usage' -- Added for AI features
  ));

-- 2. Update deduct_user_tokens to use 'ai_usage' instead of 'expense'
CREATE OR REPLACE FUNCTION deduct_user_tokens(
    p_user_id UUID,
    p_amount INT,
    p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_tokens INT;
BEGIN
    -- Check positive amount
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    -- Get current tokens with row lock
    SELECT tokens INTO v_current_tokens
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_tokens IS NULL THEN
         RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Check balance
    IF v_current_tokens < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient tokens');
    END IF;

    -- Deduct
    UPDATE profiles
    SET tokens = tokens - p_amount
    WHERE id = p_user_id;

    -- Record transaction
    INSERT INTO token_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, -p_amount, 'ai_usage', p_reason);

    RETURN json_build_object('success', true, 'remaining', v_current_tokens - p_amount);
END;
$$;
