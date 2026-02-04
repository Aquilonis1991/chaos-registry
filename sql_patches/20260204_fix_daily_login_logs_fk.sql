-- Fix FK on daily_login_logs (or daily_logins?) to allow Cascade Delete
-- User reported: violates foreign key constraint "daily_login_logs_user_id_fkey" on table "daily_login_logs"

DO $$
BEGIN
    -- 1. Check if table 'daily_login_logs' exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_login_logs' AND table_schema = 'public') THEN
        
        -- Drop existing constraint
        ALTER TABLE public.daily_login_logs DROP CONSTRAINT IF EXISTS daily_login_logs_user_id_fkey;
        
        -- Add Cascade constraint
        ALTER TABLE public.daily_login_logs
        ADD CONSTRAINT daily_login_logs_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Updated daily_login_logs FK to Cascade.';
    ELSE
        RAISE NOTICE 'Table daily_login_logs not found. Checking daily_logins...';
    END IF;

    -- Just in case, check 'daily_logins' too if it exists (as seen in other files)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_logins' AND table_schema = 'public') THEN
        
        -- Drop existing constraint (guessing name for daily_logins)
        ALTER TABLE public.daily_logins DROP CONSTRAINT IF EXISTS daily_logins_user_id_fkey;
        
        -- Add Cascade constraint
        ALTER TABLE public.daily_logins
        ADD CONSTRAINT daily_logins_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Updated daily_logins FK to Cascade.';
    END IF;
END $$;
