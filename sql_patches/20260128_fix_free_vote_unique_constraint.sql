-- FIX FREE VOTE UNIQUE CONSTRAINT (COLUMN BASED)
-- Date: 2026-01-28
-- Description:
-- 1. Adds 'vote_date' column to explicit track the vote day (UTC).
-- 2. Drops the incorrect unique constraint.
-- 3. Creates correct unique index on (user_id, topic_id, vote_date).

BEGIN;

-- 1. Drop incorrect constraint if it exists (The one causing "Duplicate key")
ALTER TABLE public.free_votes
DROP CONSTRAINT IF EXISTS free_votes_user_id_topic_id_key;

DROP INDEX IF EXISTS free_votes_user_id_topic_id_key;

-- 2. Add vote_date column (Safe way)
-- We use a concrete column because Indexing on DATE(timestamptz) is not immutable in Postgres
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'free_votes' AND column_name = 'vote_date') THEN
        ALTER TABLE public.free_votes 
        ADD COLUMN vote_date DATE DEFAULT (NOW() AT TIME ZONE 'UTC')::DATE;
    END IF;
END $$;

-- 3. Backfill data for existing rows (if any nulls)
UPDATE public.free_votes 
SET vote_date = (used_at AT TIME ZONE 'UTC')::DATE 
WHERE vote_date IS NULL;

-- 4. Ensure it is NOT NULL
ALTER TABLE public.free_votes 
ALTER COLUMN vote_date SET NOT NULL;

-- 5. Create the correct unique index
DROP INDEX IF EXISTS idx_free_votes_user_topic_date;

CREATE UNIQUE INDEX idx_free_votes_user_topic_date 
ON public.free_votes (user_id, topic_id, vote_date);

COMMIT;

