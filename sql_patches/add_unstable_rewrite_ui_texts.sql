-- ==========================================
-- Add UI Texts for Unstable Rewrite
-- ==========================================

-- Helper function to insert or update ui_texts
CREATE OR REPLACE FUNCTION public.upsert_ui_text_v2(
    p_key TEXT,
    p_value TEXT,
    p_category TEXT,
    p_description TEXT,
    p_zh TEXT,
    p_en TEXT,
    p_ja TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja, created_at, updated_at)
    VALUES (p_key, p_value, p_category, p_description, p_zh, p_en, p_ja, now(), now())
    ON CONFLICT (key) 
    DO UPDATE SET 
        value = EXCLUDED.value,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        zh = EXCLUDED.zh,
        en = EXCLUDED.en,
        ja = EXCLUDED.ja,
        updated_at = now();
END;
$$;

-- Insert Texts
SELECT public.upsert_ui_text_v2(
    'topic.unstable_rewrite.button',
    '不穩定改寫',
    'topic_create',
    'Button label for AI rewrite',
    '不穩定改寫',
    'Unstable Rewrite',
    '不安定な書き換え'
);

SELECT public.upsert_ui_text_v2(
    'topic.unstable_rewrite.loading',
    '正在進行混亂改寫...',
    'topic_create',
    'Loading state for AI rewrite',
    '正在進行混亂改寫...',
    'Rewriting chaotically...',
    '混沌とした書き換え中...'
);

SELECT public.upsert_ui_text_v2(
    'topic.unstable_rewrite.confirm_title',
    '不穩定改寫確認',
    'topic_create',
    'Title for rewrite confirmation dialog',
    '不穩定改寫確認',
    'Rewrite Confirmation',
    '書き換え確認'
);

SELECT public.upsert_ui_text_v2(
    'topic.unstable_rewrite.confirm_message',
    '我們把你的內容改成了這個樣子，確定要用嗎？',
    'topic_create',
    'Message for rewrite confirmation',
    '我們把你的內容改成了這個樣子，確定要用嗎？',
    'We''ve distorted your content into this. Are you sure you want to use it?',
    'コンテンツをこのように歪めました。本当によろしいですか？'
);

SELECT public.upsert_ui_text_v2(
    'topic.unstable_rewrite.apply',
    '套用改寫',
    'topic_create',
    'Button to apply rewrite',
    '套用改寫',
    'Apply Rewrite',
    '書き換えを適用'
);

SELECT public.upsert_ui_text_v2(
    'topic.unstable_rewrite.cancel',
    '保留原樣',
    'topic_create',
    'Button to cancel rewrite',
    '保留原樣',
    'Keep Original',
    '元のままにする'
);

SELECT public.upsert_ui_text_v2(
    'topic.unstable_rewrite.daily_free',
    '每日首次免費',
    'topic_create',
    'Badge for free daily use',
    '每日首次免費',
    'First Daily Free',
    '毎日初回無料'
);

SELECT public.upsert_ui_text_v2(
    'topic.unstable_rewrite.daily_used',
    '今日已用 ({{amount}} 代幣)',
    'topic_create',
    'Badge for paid daily use',
    '今日已用 ({{amount}} 代幣)',
    'Used Today ({{amount}} Tokens)',
    '本日使用済み ({{amount}} トークン)'
);

-- Drop helper function
DROP FUNCTION public.upsert_ui_text_v2;
