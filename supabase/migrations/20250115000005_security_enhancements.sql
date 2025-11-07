-- ============================================
-- 安全增強遷移
-- 1. 用戶封鎖系統
-- 2. IP 黑名單系統
-- 3. 內容過濾（敏感詞）
-- 4. 審計日誌增強
-- ============================================

-- ============================================
-- 1. 用戶封鎖系統
-- ============================================

-- 封鎖類型枚舉
CREATE TYPE block_type AS ENUM (
  'temporary',    -- 臨時封鎖
  'permanent',    -- 永久封鎖
  'warning'       -- 警告狀態
);

-- 封鎖原因枚舉
CREATE TYPE block_reason AS ENUM (
  'spam',              -- 發送垃圾訊息
  'harassment',        -- 騷擾其他用戶
  'hate_speech',       -- 仇恨言論
  'fraud',             -- 詐騙行為
  'multiple_accounts', -- 多重帳號
  'vote_manipulation', -- 操控投票
  'other'              -- 其他原因
);

-- 用戶封鎖表
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_type block_type NOT NULL DEFAULT 'temporary',
  reason block_reason NOT NULL,
  reason_detail TEXT,
  
  -- 時間管理
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ, -- NULL 表示永久封鎖
  unblocked_at TIMESTAMPTZ,
  
  -- 管理員資訊
  blocked_by UUID REFERENCES auth.users(id),
  unblocked_by UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  
  -- 狀態
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_user_blocks_user_id ON user_blocks(user_id);
CREATE INDEX idx_user_blocks_active ON user_blocks(is_active) WHERE is_active = true;
CREATE INDEX idx_user_blocks_expires ON user_blocks(blocked_until) WHERE blocked_until IS NOT NULL;

-- 自動更新時間戳
CREATE TRIGGER update_user_blocks_updated_at
  BEFORE UPDATE ON user_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 政策
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- 用戶可以查看自己的封鎖記錄
CREATE POLICY "Users can view own blocks"
  ON user_blocks FOR SELECT
  USING (auth.uid() = user_id);

-- 管理員可以查看所有封鎖
CREATE POLICY "Admins can view all blocks"
  ON user_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 管理員可以創建封鎖
CREATE POLICY "Admins can create blocks"
  ON user_blocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 管理員可以更新封鎖
CREATE POLICY "Admins can update blocks"
  ON user_blocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================
-- 2. IP 黑名單系統
-- ============================================

-- IP 封鎖類型
CREATE TYPE ip_block_type AS ENUM (
  'temporary',
  'permanent',
  'suspicious'  -- 可疑但未封鎖，僅記錄
);

-- IP 黑名單表
CREATE TABLE IF NOT EXISTS ip_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  block_type ip_block_type NOT NULL DEFAULT 'temporary',
  reason TEXT NOT NULL,
  
  -- 時間管理
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ,
  
  -- 統計
  violation_count INTEGER NOT NULL DEFAULT 1,
  last_violation_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 管理
  blocked_by UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_ip_blacklist_ip ON ip_blacklist(ip_address);
CREATE INDEX idx_ip_blacklist_active ON ip_blacklist(is_active) WHERE is_active = true;

-- 自動更新時間戳
CREATE TRIGGER update_ip_blacklist_updated_at
  BEFORE UPDATE ON ip_blacklist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 政策
ALTER TABLE ip_blacklist ENABLE ROW LEVEL SECURITY;

-- 僅管理員可以查看
CREATE POLICY "Admins can view ip blacklist"
  ON ip_blacklist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 僅管理員可以管理
CREATE POLICY "Admins can manage ip blacklist"
  ON ip_blacklist FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================
-- 3. 內容過濾（敏感詞系統）
-- ============================================

-- 敏感詞類別
CREATE TYPE sensitive_word_category AS ENUM (
  'profanity',      -- 髒話
  'hate_speech',    -- 仇恨言論
  'sexual',         -- 色情內容
  'violence',       -- 暴力內容
  'political',      -- 政治敏感
  'fraud',          -- 詐騙相關
  'personal_info',  -- 個人資訊
  'spam',           -- 垃圾訊息
  'other'           -- 其他
);

-- 處理動作
CREATE TYPE filter_action AS ENUM (
  'block',          -- 阻止發布
  'review',         -- 標記待審核
  'replace',        -- 替換為星號
  'warn'            -- 僅警告
);

-- 敏感詞表
CREATE TABLE IF NOT EXISTS sensitive_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  category sensitive_word_category NOT NULL,
  action filter_action NOT NULL DEFAULT 'review',
  severity INTEGER NOT NULL DEFAULT 1, -- 1-5, 5最嚴重
  
  -- 匹配選項
  case_sensitive BOOLEAN NOT NULL DEFAULT false,
  whole_word_only BOOLEAN NOT NULL DEFAULT false,
  regex_pattern TEXT, -- 如果需要正則匹配
  
  -- 管理
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_by UUID REFERENCES auth.users(id),
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_sensitive_words_category ON sensitive_words(category);
CREATE INDEX idx_sensitive_words_active ON sensitive_words(is_active) WHERE is_active = true;

-- 自動更新時間戳
CREATE TRIGGER update_sensitive_words_updated_at
  BEFORE UPDATE ON sensitive_words
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 政策
ALTER TABLE sensitive_words ENABLE ROW LEVEL SECURITY;

-- 僅管理員可見
CREATE POLICY "Admins can manage sensitive words"
  ON sensitive_words FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================
-- 4. 審計日誌增強（添加 IP 欄位）
-- ============================================

-- 添加 IP 地址欄位到 audit_logs
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS device_info JSONB;

-- 創建 IP 索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip_address);

-- ============================================
-- 5. 檢查函數：用戶是否被封鎖
-- ============================================

CREATE OR REPLACE FUNCTION is_user_blocked(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_blocks
    WHERE user_id = check_user_id
      AND is_active = true
      AND (
        blocked_until IS NULL  -- 永久封鎖
        OR blocked_until > now()  -- 臨時封鎖未過期
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. 檢查函數：IP 是否被封鎖
-- ============================================

CREATE OR REPLACE FUNCTION is_ip_blocked(check_ip TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM ip_blacklist
    WHERE ip_address = check_ip
      AND is_active = true
      AND block_type IN ('permanent', 'temporary')
      AND (
        blocked_until IS NULL
        OR blocked_until > now()
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. 函數：記錄 IP 違規
-- ============================================

CREATE OR REPLACE FUNCTION record_ip_violation(
  violation_ip TEXT,
  violation_reason TEXT,
  admin_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  existing_record RECORD;
  new_count INTEGER;
BEGIN
  -- 查找現有記錄
  SELECT * INTO existing_record
  FROM ip_blacklist
  WHERE ip_address = violation_ip AND is_active = true;
  
  IF FOUND THEN
    -- 更新現有記錄
    new_count := existing_record.violation_count + 1;
    
    UPDATE ip_blacklist
    SET 
      violation_count = new_count,
      last_violation_at = now(),
      updated_at = now()
    WHERE ip_address = violation_ip;
    
    -- 如果違規超過 5 次，自動封鎖
    IF new_count >= 5 THEN
      UPDATE ip_blacklist
      SET 
        block_type = 'permanent',
        reason = 'Auto-blocked: Multiple violations',
        blocked_at = now(),
        updated_at = now()
      WHERE ip_address = violation_ip;
    END IF;
    
  ELSE
    -- 創建新記錄
    INSERT INTO ip_blacklist (
      ip_address,
      block_type,
      reason,
      blocked_by,
      violation_count
    ) VALUES (
      violation_ip,
      'suspicious',
      violation_reason,
      admin_id,
      1
    );
    new_count := 1;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'ip', violation_ip,
    'violation_count', new_count,
    'is_blocked', new_count >= 5
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. 插入預設敏感詞（中文常見）
-- ============================================

INSERT INTO sensitive_words (word, category, action, severity) VALUES
-- 髒話類
('fuck', 'profanity', 'replace', 4),
('shit', 'profanity', 'replace', 3),
('damn', 'profanity', 'warn', 2),
('幹', 'profanity', 'replace', 4),
('靠', 'profanity', 'replace', 3),
('他媽的', 'profanity', 'replace', 5),

-- 詐騙類
('免費代幣', 'fraud', 'block', 5),
('快速致富', 'fraud', 'block', 5),
('保證獲利', 'fraud', 'block', 5),
('私訊領取', 'fraud', 'review', 4),
('加LINE', 'fraud', 'review', 3),

-- 個人資訊類
('身分證字號', 'personal_info', 'block', 5),
('信用卡號', 'personal_info', 'block', 5),
('密碼', 'personal_info', 'review', 3),

-- 垃圾訊息類
('點擊領取', 'spam', 'review', 3),
('限時優惠', 'spam', 'review', 2),
('免費試用', 'spam', 'warn', 2)

ON CONFLICT DO NOTHING;

-- ============================================
-- 9. 內容過濾函數
-- ============================================

CREATE OR REPLACE FUNCTION check_content_for_sensitive_words(content TEXT)
RETURNS JSONB AS $$
DECLARE
  word_record RECORD;
  found_words TEXT[] := ARRAY[]::TEXT[];
  highest_severity INTEGER := 0;
  recommended_action filter_action := 'warn';
BEGIN
  -- 檢查每個敏感詞
  FOR word_record IN 
    SELECT * FROM sensitive_words WHERE is_active = true
  LOOP
    -- 根據設置進行匹配
    IF (
      (word_record.case_sensitive AND content LIKE '%' || word_record.word || '%')
      OR
      (NOT word_record.case_sensitive AND LOWER(content) LIKE '%' || LOWER(word_record.word) || '%')
    ) THEN
      found_words := array_append(found_words, word_record.word);
      
      -- 追蹤最高嚴重度
      IF word_record.severity > highest_severity THEN
        highest_severity := word_record.severity;
        recommended_action := word_record.action;
      END IF;
    END IF;
  END LOOP;
  
  -- 返回結果
  RETURN jsonb_build_object(
    'has_sensitive_words', array_length(found_words, 1) > 0,
    'found_words', found_words,
    'severity', highest_severity,
    'recommended_action', recommended_action
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. 評論
-- ============================================

COMMENT ON TABLE user_blocks IS '用戶封鎖記錄表';
COMMENT ON TABLE ip_blacklist IS 'IP 黑名單表';
COMMENT ON TABLE sensitive_words IS '敏感詞過濾表';
COMMENT ON FUNCTION is_user_blocked IS '檢查用戶是否被封鎖';
COMMENT ON FUNCTION is_ip_blocked IS '檢查 IP 是否被封鎖';
COMMENT ON FUNCTION check_content_for_sensitive_words IS '檢查內容是否包含敏感詞';


