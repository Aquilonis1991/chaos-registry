-- Create security_rate_limits table for handling Login Lockout and Registration Cooldowns

CREATE TABLE IF NOT EXISTS public.security_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- Email (for login) or DeviceID/IP (for signup)
    ip_address TEXT,
    action_type TEXT NOT NULL, -- 'login', 'signup_email'
    attempt_count INT DEFAULT 1,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by identifier (Email/DeviceID)
CREATE INDEX IF NOT EXISTS idx_security_limits_lookup ON public.security_rate_limits (identifier, action_type);

-- Index for fast lookups by IP address (for IP-based rate limiting)
CREATE INDEX IF NOT EXISTS idx_security_limits_ip ON public.security_rate_limits (ip_address, action_type);

-- RLS Policies (Optional but good practice, though Edge Function uses Service Key)
ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow service_role to access this table (Edge Function)
DROP POLICY IF EXISTS "Service Role only" ON public.security_rate_limits;

CREATE POLICY "Service Role only" ON public.security_rate_limits
    AS PERMISSIVE
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
