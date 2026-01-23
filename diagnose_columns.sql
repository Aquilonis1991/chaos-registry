-- Diagnostics 2: Column Verification
DO $$ 
DECLARE
    v_has_creator_id boolean;
    v_has_created_by boolean;
    v_has_total_votes boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'creator_id') INTO v_has_creator_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'created_by') INTO v_has_created_by;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topics' AND column_name = 'total_votes') INTO v_has_total_votes;

    RAISE NOTICE 'Column Check 2:';
    RAISE NOTICE '  has creator_id: %', v_has_creator_id;
    RAISE NOTICE '  has created_by: %', v_has_created_by;
    RAISE NOTICE '  has total_votes: %', v_has_total_votes;

    IF NOT v_has_creator_id THEN
        RAISE NOTICE 'WARNING: creator_id is missing!';
    END IF;

    IF v_has_created_by THEN
        RAISE NOTICE 'NOTE: created_by exists.';
    ELSE
        RAISE NOTICE 'CONFIRMED: created_by DOES NOT exist. RPC using it will fail.';
    END IF;

    IF NOT v_has_total_votes THEN
        RAISE NOTICE 'CONFIRMED: total_votes DOES NOT exist. RPC using it will fail.';
    END IF;
END $$;
