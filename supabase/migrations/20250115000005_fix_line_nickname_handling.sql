-- ========================================
-- 修復 LINE 登入暱稱處理問題
-- 問題：LINE 登入時，暱稱可能包含額外字符或格式不正確，導致無法後續修正
-- 解決：清理和規範化暱稱，處理多種可能的字段名稱
-- ========================================

-- 創建清理暱稱的輔助函數
CREATE OR REPLACE FUNCTION public.clean_nickname(raw_nickname TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned TEXT;
BEGIN
  -- 如果為空，返回默認值
  IF raw_nickname IS NULL OR trim(raw_nickname) = '' THEN
    RETURN 'User';
  END IF;
  
  -- 清理暱稱
  cleaned := trim(raw_nickname);
  
  -- 移除多餘的空白字符（多個空格、換行符等）
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  
  -- 限制長度為 50 個字符（符合資料庫約束）
  IF length(cleaned) > 50 THEN
    cleaned := substring(cleaned FROM 1 FOR 50);
  END IF;
  
  -- 再次 trim（因為 substring 可能留下尾隨空格）
  cleaned := trim(cleaned);
  
  -- 如果清理後為空，返回默認值
  IF cleaned = '' THEN
    RETURN 'User';
  END IF;
  
  RETURN cleaned;
END;
$$;

-- 更新 handle_new_user 函數，正確處理 LINE 和其他 OAuth 提供商的暱稱
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  initial_tokens integer;
  raw_nickname TEXT;
  cleaned_nickname TEXT;
  raw_avatar TEXT;
BEGIN
  -- Get initial token amount from system config
  SELECT (value::text)::integer INTO initial_tokens
  FROM public.system_config
  WHERE key = 'new_user_tokens';
  
  -- Fallback to 50 if config not found
  IF initial_tokens IS NULL THEN
    initial_tokens := 50;
  END IF;
  
  -- 嘗試從多個可能的字段獲取暱稱（處理不同 OAuth 提供商）
  -- 優先順序：nickname > full_name > display_name > name
  raw_nickname := COALESCE(
    NEW.raw_user_meta_data->>'nickname',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'username'
  );
  
  -- 清理暱稱
  cleaned_nickname := public.clean_nickname(raw_nickname);
  
  -- 獲取頭像
  raw_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'photo_url',
    '🔥'
  );
  
  -- 限制頭像長度
  IF length(raw_avatar) > 10 THEN
    raw_avatar := substring(raw_avatar FROM 1 FOR 10);
  END IF;
  
  INSERT INTO public.profiles (id, nickname, avatar, tokens)
  VALUES (
    NEW.id,
    cleaned_nickname,
    raw_avatar,
    initial_tokens
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- 如果插入失敗（例如 profile 已存在），忽略錯誤
    RETURN NEW;
END;
$$;

-- 添加註釋說明
COMMENT ON FUNCTION public.clean_nickname IS '清理和規範化用戶暱稱，移除多餘空格，限制長度';
COMMENT ON FUNCTION public.handle_new_user IS '處理新用戶註冊，自動創建 profile，正確處理 LINE 和其他 OAuth 提供商的暱稱';

