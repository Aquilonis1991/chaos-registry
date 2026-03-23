-- 移除無程式讀取、功能尚未實作的 system_config 變數
-- 對應系統配置功能對照表審查結果
DELETE FROM public.system_config
WHERE key IN (
  'report_email_notifications',
  'report_admin_email',
  'report_auto_hide_threshold',
  'report_require_auth',
  'announcement_max_display',
  'announcement_title_max_length',
  'announcement_content_max_length',
  'announcement_summary_max_length',
  'announcement_auto_deactivate',
  'ai_official_summary_prompt'
);
