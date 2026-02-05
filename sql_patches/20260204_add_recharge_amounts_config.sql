-- Insert or Update 'recharge_amounts' in system_config
-- This moves the configuration from hardcoded frontend code to the database
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'recharge_amounts',
  '[
    {"id": 1, "tokens": 100, "price": 30, "icon": "Coins", "popular": false, "bonus": 0},
    {"id": 2, "tokens": 500, "price": 150, "icon": "Zap", "popular": true, "bonus": 75},
    {"id": 3, "tokens": 1000, "price": 280, "icon": "Star", "popular": false, "bonus": 150},
    {"id": 4, "tokens": 3000, "price": 800, "icon": "Crown", "popular": false, "bonus": 600}
  ]'::json,
  'payment',
  'Configuration for token recharge packages'
)
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- Force Schema Refresh
NOTIFY pgrst, 'reload schema';
