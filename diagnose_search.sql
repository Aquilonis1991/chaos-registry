-- Diagnostics for Search Functionality
-- Run this in Supabase SQL Editor to check why search is failing

DO $$ 
DECLARE
    v_has_status boolean;
    v_has_options boolean;
    v_has_tags boolean;
    v_rec record;
BEGIN
    RAISE NOTICE 'Starting Diagnostics...';

    -- 1. Check Table Columns
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'status') INTO v_has_status;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'options') INTO v_has_options;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'tags') INTO v_has_tags;

    RAISE NOTICE 'Column Check: status=%, options=%, tags=%', v_has_status, v_has_options, v_has_tags;

    IF NOT v_has_status THEN
        RAISE EXCEPTION 'CRITICAL: status column missing from topics table!';
    END IF;

    IF NOT v_has_options THEN
        RAISE EXCEPTION 'CRITICAL: options column missing from topics table!';
    END IF;

    -- 2. Test the query logic directly (Limit 1)
    FOR v_rec IN 
        SELECT id, title, status FROM topics 
        WHERE status != 'deleted' 
        LIMIT 1
    LOOP
        RAISE NOTICE 'Sample Topic Found: ID=%, Title=%, Status=%', v_rec.id, v_rec.title, v_rec.status;
    END LOOP;

    RAISE NOTICE 'Diagnostics Completed Successfully. If you see this, the table structure is correct.';
END $$;
