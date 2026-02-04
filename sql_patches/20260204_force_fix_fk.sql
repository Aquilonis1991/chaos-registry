-- Force Fix FK on daily_login_logs
-- This script explicitly drops and recreates the constraint.

BEGIN;

-- 1. daily_login_logs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_login_logs' AND table_schema = 'public') THEN
        ALTER TABLE public.daily_login_logs DROP CONSTRAINT IF EXISTS daily_login_logs_user_id_fkey;
        
        ALTER TABLE public.daily_login_logs
        ADD CONSTRAINT daily_login_logs_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Fixed daily_login_logs FK.';
    END IF;
END $$;

-- 2. daily_logins (Just in case, as code references both)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_logins' AND table_schema = 'public') THEN
        ALTER TABLE public.daily_logins DROP CONSTRAINT IF EXISTS daily_logins_user_id_fkey;
        
        ALTER TABLE public.daily_logins
        ADD CONSTRAINT daily_logins_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Fixed daily_logins FK.';
    END IF;
END $$;

COMMIT;
