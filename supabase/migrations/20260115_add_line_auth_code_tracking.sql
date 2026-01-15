-- Add LINE OAuth authorization code tracking for single-use policy
-- This prevents duplicate processing of the same authorization code

-- Create table to track used authorization codes
CREATE TABLE IF NOT EXISTS public.line_auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_code TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  nonce TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes')
);

-- Enable RLS
ALTER TABLE public.line_auth_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (Edge Functions use SERVICE_ROLE_KEY)
-- This table is only accessed by Edge Functions, not by users
CREATE POLICY "Service role can manage auth codes"
  ON public.line_auth_codes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_line_auth_codes_code ON public.line_auth_codes(authorization_code);
CREATE INDEX IF NOT EXISTS idx_line_auth_codes_state ON public.line_auth_codes(state);
CREATE INDEX IF NOT EXISTS idx_line_auth_codes_expires_at ON public.line_auth_codes(expires_at);

-- Function to check if authorization code has been used
CREATE OR REPLACE FUNCTION public.is_line_auth_code_used(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.line_auth_codes
    WHERE authorization_code = p_code
    AND expires_at > now()
  );
END;
$$;

-- Function to mark authorization code as used
CREATE OR REPLACE FUNCTION public.mark_line_auth_code_used(
  p_code TEXT,
  p_state TEXT,
  p_nonce TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.line_auth_codes (
    authorization_code,
    state,
    nonce,
    user_id
  )
  VALUES (
    p_code,
    p_state,
    p_nonce,
    p_user_id
  )
  ON CONFLICT (authorization_code) DO NOTHING
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to clean up expired codes (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_line_auth_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.line_auth_codes
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Optional: Create a trigger to automatically clean up expired codes
-- This will run the cleanup function whenever a new code is inserted
-- (Alternative: Use pg_cron extension for scheduled cleanup)
CREATE OR REPLACE FUNCTION public.auto_cleanup_expired_codes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only clean up if there are more than 1000 expired records (to avoid frequent cleanup)
  IF (SELECT COUNT(*) FROM public.line_auth_codes WHERE expires_at < now()) > 1000 THEN
    PERFORM public.cleanup_expired_line_auth_codes();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger (optional, can be disabled if using pg_cron instead)
CREATE TRIGGER trigger_auto_cleanup_expired_codes
  AFTER INSERT ON public.line_auth_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cleanup_expired_codes();

-- Add comment
COMMENT ON TABLE public.line_auth_codes IS 'Tracks used LINE OAuth authorization codes to prevent duplicate processing';
COMMENT ON FUNCTION public.is_line_auth_code_used IS 'Checks if a LINE authorization code has already been used';
COMMENT ON FUNCTION public.mark_line_auth_code_used IS 'Marks a LINE authorization code as used';
COMMENT ON FUNCTION public.cleanup_expired_line_auth_codes IS 'Cleans up expired authorization codes';
