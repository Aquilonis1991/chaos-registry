-- ========================================
-- Add Daily Topic Discount Configuration
-- ========================================

-- Insert the configuration key for daily topic discount
-- Default to 0 (disabled), but user can change it in Admin Panel.
-- To Verify immediately, you can change 0 to 5.

INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'daily_topic_discount_tokens', 
  '5'::jsonb, 
  'topic_cost',
  '每日首次發起主題可折抵的代幣數量 (0 為關閉)'
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value,
    category = EXCLUDED.category,
    description = EXCLUDED.description;
