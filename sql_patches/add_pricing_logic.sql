-- 1. Add pricing config
INSERT INTO system_config (key, value, category, description)
VALUES 
    ('irrational_assessment_cost', '5', 'pricing', 'Cost for irrationality assessment (free for first weekly attempt)')
ON CONFLICT (key) DO NOTHING;

-- 2. Create deduct_user_tokens RPC
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
    VALUES (p_user_id, -p_amount, 'expense', p_reason);

    RETURN json_build_object('success', true, 'remaining', v_current_tokens - p_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_user_tokens(UUID, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION deduct_user_tokens(UUID, INT, TEXT) TO authenticated;
