-- 新增每日首篇主題折扣金額設定（單位：代幣）
INSERT INTO public.system_config (key, value, category, description)
VALUES
  ('daily_topic_discount_tokens', to_jsonb(30), 'topic_cost', '每日第一次發起主題可折抵的代幣數量')
ON CONFLICT (key) DO NOTHING;




