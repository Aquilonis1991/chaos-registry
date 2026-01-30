
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE c.conrelid = 'public.free_votes'::regclass;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'free_votes';
