-- =================================================================
-- DELETE UNUSED CONFIG: mission_vote_reward
-- 
-- This key was intended for a "Reward per Vote" feature that is not
-- implemented and contradicts the "Vote Costs Tokens" model.
-- =================================================================

DELETE FROM public.system_config 
WHERE key = 'mission_vote_reward';

-- Verify deletion
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.system_config WHERE key = 'mission_vote_reward') THEN
        RAISE NOTICE 'Failed to delete mission_vote_reward';
    ELSE
        RAISE NOTICE 'Successfully deleted mission_vote_reward';
    END IF;
END $$;
