-- 補上缺失的 topic_participants 表
-- 用於解決 "relation public.topic_participants does not exist" 錯誤

BEGIN;

CREATE TABLE IF NOT EXISTS public.topic_participants (
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (topic_id, user_id)
);

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_topic_participants_user_id ON public.topic_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_participants_topic_id ON public.topic_participants(topic_id);

-- 啟用 RLS (雖然後端函數通常使用 SECURITY DEFINER 繞過，但為了安全仍建議啟用)
ALTER TABLE public.topic_participants ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀取 (如果需要顯示參與者列表)
CREATE POLICY "Anyone can view topic participants" ON public.topic_participants
    FOR SELECT USING (true);

-- 僅允許系統函數寫入 (普通用戶不能直接插入)
-- 這裡不建立 INSERT/UPDATE 策略，因為寫入都是透過 RPC 進行

COMMIT;
