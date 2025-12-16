-- Add function to safely log token transactions
-- This function bypasses RLS policies using SECURITY DEFINER
-- to allow users to log their own transactions

CREATE OR REPLACE FUNCTION public.log_token_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_allowed_types TEXT[] := ARRAY[
    'create_topic',
    'free_create_topic',
    'cast_vote',
    'cast_free_vote',
    'free_vote',
    'complete_mission',
    'watch_ad',
    'admin_adjustment',
    'purchase'
  ];
BEGIN
  -- Verify that the user is authenticated and matches the user_id
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'User can only log transactions for themselves';
  END IF;
  
  -- Validate transaction type
  IF NOT (p_transaction_type = ANY(v_allowed_types)) THEN
    RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
  END IF;
  
  -- Insert the transaction
  INSERT INTO public.token_transactions (
    user_id,
    amount,
    transaction_type,
    reference_id,
    description
  )
  VALUES (
    p_user_id,
    p_amount,
    p_transaction_type,
    p_reference_id,
    p_description
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.log_token_transaction TO authenticated;


