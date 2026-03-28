-- PostgREST / mobile clients that send only p_topic_id, p_content, p_buy_shield hit:
-- "Could not choose the best candidate function between ... (boolean) and ... (boolean, text)"
-- because the 4-arg overload has DEFAULTs and is equally valid for a 3-argument call.
-- Keep a single overload: (uuid, text, boolean, text) with defaults on the last two args.

DROP FUNCTION IF EXISTS public.post_arena_message(uuid, text, boolean);

GRANT EXECUTE ON FUNCTION public.post_arena_message(uuid, text, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
