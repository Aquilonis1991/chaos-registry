-- 為後台條款管理新增預設系統配置
INSERT INTO public.system_config (key, value, category, description)
VALUES
  (
    'legal_terms_content',
    '請在後台「條款管理」分頁更新使用者條款內容。支援換行，暫不支援 Markdown 格式。',
    'legal',
    '使用者條款全文（顯示於 /terms 頁面）'
  ),
  (
    'legal_privacy_content',
    '請在後台「條款管理」分頁更新隱私權政策內容。支援換行，暫不支援 Markdown 格式。',
    'legal',
    '隱私權政策全文（顯示於 /privacy 頁面）'
  )
ON CONFLICT (key) DO NOTHING;

