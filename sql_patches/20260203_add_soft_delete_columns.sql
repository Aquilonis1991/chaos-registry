-- ADD SOFT DELETE COLUMNS to PROFILES
-- This enables the "Soft Delete" state.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_reason text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON public.profiles(is_deleted);

NOTIFY pgrst, 'reload config';
