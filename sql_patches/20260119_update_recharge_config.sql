-- Update recharge_amounts to match new product definitions
-- Medium: 500 + 75 bonus
-- XLarge: 3000 + 600 bonus

INSERT INTO public.system_config (key, value, category, description)
VALUES 
  ('recharge_amounts', '[
    {"id": 1, "tokens": 100, "price": 30, "icon": "Coins", "popular": false, "bonus": 0},
    {"id": 2, "tokens": 500, "price": 150, "icon": "Zap", "popular": true, "bonus": 75},
    {"id": 3, "tokens": 1000, "price": 280, "icon": "Star", "popular": false, "bonus": 150},
    {"id": 4, "tokens": 3000, "price": 800, "icon": "Crown", "popular": false, "bonus": 600}
  ]'::jsonb, 'wallet', '儲值金額選項')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;
