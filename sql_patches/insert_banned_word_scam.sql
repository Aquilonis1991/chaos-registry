-- ========================================
-- Insert '詐騙' into Banned Words
-- ========================================

INSERT INTO public.banned_words (keyword, level, action, category, is_active)
VALUES ('詐騙', 'A', 'block', 'fraud', true)
ON CONFLICT (keyword, level) 
DO UPDATE SET 
    action = EXCLUDED.action,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active;
