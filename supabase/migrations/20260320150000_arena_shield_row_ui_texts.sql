-- 角鬥場：數據鎖定保險列（互動擴充版式用）
SELECT public.upsert_ui_text_v2(
  'arena.shieldTitle',
  '購買數據鎖定保險',
  'arena',
  'Switch 列標題',
  '購買數據鎖定保險',
  'Buy data lock insurance',
  'データロック保険'
);

SELECT public.upsert_ui_text_v2(
  'arena.shieldCostLine',
  '{{price}} 代幣',
  'arena',
  '代幣列（{{price}} 為佔位）',
  '{{price}} 代幣',
  '{{price}} tokens',
  '{{price}} トークン'
);
