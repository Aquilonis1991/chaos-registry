-- SQL Patch: Add UI texts for Irrationality Assessment
-- Depends on upsert_ui_text_v2 function existing

SELECT public.upsert_ui_text_v2(
    'profile.assessment.button',
    '不理性鑑定',
    'profile',
    'Button label for taking the assessment',
    '不理性鑑定',
    'Irrationality Assessment',
    '非合理的診断'
);

SELECT public.upsert_ui_text_v2(
    'profile.assessment.title',
    '不理性鑑定',
    'profile',
    'Title of the assessment section',
    '不理性鑑定',
    'Irrationality Assessment',
    '非合理的診断'
);

SELECT public.upsert_ui_text_v2(
    'profile.assessment.disclaimer',
    '娛樂用途，非心理分析',
    'profile',
    'Disclaimer string',
    '娛樂用途，非心理分析',
    'For entertainment only, not psychological analysis',
    '娯楽目的であり、心理分析ではありません'
);

SELECT public.upsert_ui_text_v2(
    'profile.assessment.cooldown',
    '本週已完成一次鑑定',
    'profile',
    'Message shown when weekly limit reached',
    '本週已完成一次鑑定',
    'Assessment already completed this week',
    '今週はすでに診断済みです'
);

SELECT public.upsert_ui_text_v2(
    'profile.assessment.loading',
    '正在分析您的行為模式...',
    'profile',
    'Loading text',
    '正在分析您的行為模式...',
    'Analyzing your behavior patterns...',
    '行動パターンを分析中...'
);

SELECT public.upsert_ui_text_v2(
    'profile.assessment.start_prompt',
    '看看 AI 眼中的你是什麼樣子？',
    'profile',
    'Prompt to encourage user to take assessment',
    '看看 AI 眼中的你是什麼樣子？',
    'See what AI thinks of you?',
    'AIから見たあなたの姿は？'
);
