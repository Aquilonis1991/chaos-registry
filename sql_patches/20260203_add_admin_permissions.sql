-- Ensure admin_users table exists
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT ALL ON public.admin_users TO postgres;
GRANT ALL ON public.admin_users TO service_role;
GRANT SELECT ON public.admin_users TO authenticated;

-- Insert the admin user (Yang Xiangyun / aquilonis1991@gmail.com)
-- ID obtained from previous logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2') THEN
        INSERT INTO public.admin_users (user_id)
        VALUES ('08fc94c1-bfb3-47ed-9191-b46fa24837f2');
    END IF;
END $$;
