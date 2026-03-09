-- 新增首頁主題卡片「已結束」圖示的 UI 文案（home.topicCard.ended）
-- 供 TopicCard 圖示 title/aria-label 多語使用

SELECT public.upsert_ui_text_v2(
  'home.topicCard.ended',
  '已結束',
  'home',
  '首頁主題卡片圖示 title/aria-label（已結束）',
  '已結束',
  'Ended',
  '終了'
);
