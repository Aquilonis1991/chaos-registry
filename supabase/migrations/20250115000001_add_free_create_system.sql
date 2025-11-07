-- Add free create topic qualification system

-- Create free_create_qualifications table to track user's free create qualifications
CREATE TABLE IF NOT EXISTS public.free_create_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qualification_type TEXT NOT NULL CHECK (qualification_type IN ('daily_login', 'mission_reward', 'admin_grant')),
  source TEXT, -- e.g., 'continuous_login_5_days', 'special_event'
  expires_at TIMESTAMPTZ, -- NULL means permanent
  used_at TIMESTAMPTZ, -- When the qualification was used
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.free_create_qualifications ENABLE ROW LEVEL SECURITY;

-- Policies for free_create_qualifications
CREATE POLICY "Users can view own free create qualifications"
  ON public.free_create_qualifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own free create qualifications"
  ON public.free_create_qualifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own free create qualifications"
  ON public.free_create_qualifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to check if user has available free create qualification
CREATE OR REPLACE FUNCTION public.has_free_create_qualification(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.free_create_qualifications
    WHERE user_id = check_user_id
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- Function to use free create qualification
CREATE OR REPLACE FUNCTION public.use_free_create_qualification(check_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qualification_id UUID;
BEGIN
  -- Find an available qualification
  SELECT id INTO qualification_id
  FROM public.free_create_qualifications
  WHERE user_id = check_user_id
  AND used_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at ASC
  LIMIT 1;

  IF qualification_id IS NULL THEN
    RAISE EXCEPTION 'No available free create qualification';
  END IF;

  -- Mark as used
  UPDATE public.free_create_qualifications
  SET used_at = now()
  WHERE id = qualification_id;

  RETURN qualification_id;
END;
$$;

-- Function to grant free create qualification
CREATE OR REPLACE FUNCTION public.grant_free_create_qualification(
  target_user_id UUID,
  qualification_type TEXT,
  source TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qualification_id UUID;
BEGIN
  INSERT INTO public.free_create_qualifications (
    user_id,
    qualification_type,
    source,
    expires_at
  ) VALUES (
    target_user_id,
    qualification_type,
    source,
    expires_at
  ) RETURNING id INTO qualification_id;

  RETURN qualification_id;
END;
$$;

-- Add system config for free create qualification settings
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('free_create_enabled', 'true', 'topic_cost', '是否啟用免費發起主題功能'),
  ('free_create_daily_login_days', '5', 'mission', '連續登入幾天獲得免費發起資格'),
  ('free_create_qualification_expire_hours', '24', 'topic_cost', '免費發起資格過期時間（小時）')
ON CONFLICT (key) DO NOTHING;
