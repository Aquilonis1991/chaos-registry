-- 1) 刪除已遷移／重複的 system_config key（統一使用 mission_* 系列）
DELETE FROM public.system_config
WHERE key IN (
  'consecutive_login_target',
  'daily_login_reward',
  'max_ads_per_day',
  'ad_reward_amount'
);

-- 2) 補齊：主題「描述」欄禁字等級（與 CreateTopicPage 一致）
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'topic_description_banned_levels',
  '["A","B","C","D","E"]'::jsonb,
  'validation',
  '主題詳述禁字檢查等級（JSON 陣列），與 topic_banned_check_levels 可分開設定'
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();

-- 3) 檢舉自動隱藏閾值（供 handle_topic_report 讀取，取代硬編碼 10）
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'report_auto_hide_threshold',
  '10'::jsonb,
  'report',
  '主題累積檢舉達此數（不同用戶）時自動隱藏；與 handle_topic_report 同步'
)
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = now();

-- 4) 前台公告輪播最多筆數（與 AnnouncementCarousel 同步）
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'announcement_max_display',
  '3'::jsonb,
  'announcement',
  '首頁／前台同時顯示的公告則數上限（傳入 get_active_announcements）'
)
ON CONFLICT (key) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = now();

-- 5) handle_topic_report：從 system_config 讀取 report_auto_hide_threshold（預設 10）
CREATE OR REPLACE FUNCTION public.handle_topic_report(
  p_topic_id UUID,
  p_reporter_id UUID,
  p_report_type TEXT,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  auto_hidden BOOLEAN,
  report_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_count INTEGER;
  v_auto_hidden BOOLEAN := false;
  v_inserted BOOLEAN := false;
  v_threshold INTEGER := 10;
  v_distinct INTEGER;
BEGIN
  SELECT COALESCE((value #>> '{}')::INTEGER, 10)
  INTO v_threshold
  FROM public.system_config
  WHERE key = 'report_auto_hide_threshold'
  LIMIT 1;

  IF v_threshold IS NULL OR v_threshold < 1 THEN
    v_threshold := 10;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reports
    WHERE reporter_id = p_reporter_id
      AND target_type = 'topic'
      AND target_id = p_topic_id
  ) THEN
    RETURN QUERY SELECT false, '你已經檢舉過此主題', false, 0;
    RETURN;
  END IF;

  INSERT INTO public.reports (
    reporter_id,
    target_type,
    target_id,
    report_type,
    reason,
    details
  )
  VALUES (
    p_reporter_id,
    'topic',
    p_topic_id,
    p_report_type,
    p_reason,
    p_details
  )
  ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT v_inserted THEN
    RETURN QUERY SELECT false, '檢舉失敗', false, 0;
    RETURN;
  END IF;

  UPDATE public.topics
  SET report_count = COALESCE(public.topics.report_count, 0) + 1
  WHERE public.topics.id = p_topic_id
  RETURNING public.topics.report_count INTO v_report_count;

  IF v_report_count IS NULL THEN
    RETURN QUERY SELECT false, '主題不存在', false, 0;
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT reporter_id)::INTEGER
  INTO v_distinct
  FROM public.reports
  WHERE target_type = 'topic'
    AND target_id = p_topic_id
    AND status != 'rejected';

  IF v_report_count >= v_threshold AND v_distinct >= v_threshold THEN
    UPDATE public.topics
    SET
      is_hidden = true,
      auto_hidden = true,
      hidden_at = now(),
      hidden_reason = format('因被 %s 位不同用戶檢舉而自動隱藏', v_threshold)
    WHERE id = p_topic_id;

    v_auto_hidden := true;
  END IF;

  RETURN QUERY SELECT true, '檢舉成功', v_auto_hidden, v_report_count;
END;
$$;
