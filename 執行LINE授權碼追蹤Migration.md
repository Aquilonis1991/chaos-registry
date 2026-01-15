# LINE 授權碼追蹤 Migration 執行指南

## 目的

實現 single-use policy，防止重複處理相同的授權碼，從根本上解決 `code_already_used` 錯誤。

## 執行步驟

### 方法 1：使用 Supabase Dashboard（推薦）

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 導航到 **SQL Editor**
4. 點擊 **New query**
5. 複製以下 SQL 並執行：

```sql
-- Add LINE OAuth authorization code tracking for single-use policy
-- This prevents duplicate processing of the same authorization code

-- Create table to track used authorization codes
CREATE TABLE IF NOT EXISTS public.line_auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_code TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  nonce TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes')
);

-- Enable RLS
ALTER TABLE public.line_auth_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (Edge Functions use SERVICE_ROLE_KEY)
-- This table is only accessed by Edge Functions, not by users
CREATE POLICY "Service role can manage auth codes"
  ON public.line_auth_codes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_line_auth_codes_code ON public.line_auth_codes(authorization_code);
CREATE INDEX IF NOT EXISTS idx_line_auth_codes_state ON public.line_auth_codes(state);
CREATE INDEX IF NOT EXISTS idx_line_auth_codes_expires_at ON public.line_auth_codes(expires_at);

-- Function to check if authorization code has been used
CREATE OR REPLACE FUNCTION public.is_line_auth_code_used(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.line_auth_codes
    WHERE authorization_code = p_code
    AND expires_at > now()
  );
END;
$$;

-- Function to mark authorization code as used
CREATE OR REPLACE FUNCTION public.mark_line_auth_code_used(
  p_code TEXT,
  p_state TEXT,
  p_nonce TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.line_auth_codes (
    authorization_code,
    state,
    nonce,
    user_id
  )
  VALUES (
    p_code,
    p_state,
    p_nonce,
    p_user_id
  )
  ON CONFLICT (authorization_code) DO NOTHING
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to clean up expired codes (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_line_auth_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.line_auth_codes
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Add comment
COMMENT ON TABLE public.line_auth_codes IS 'Tracks used LINE OAuth authorization codes to prevent duplicate processing';
COMMENT ON FUNCTION public.is_line_auth_code_used IS 'Checks if a LINE authorization code has already been used';
COMMENT ON FUNCTION public.mark_line_auth_code_used IS 'Marks a LINE authorization code as used';
COMMENT ON FUNCTION public.cleanup_expired_line_auth_codes IS 'Cleans up expired authorization codes';
```

6. 點擊 **Run** 執行

### 方法 2：使用 Supabase CLI

如果 Supabase CLI 已連接，可以執行：

```bash
npx supabase db push --include-all
```

## 驗證 Migration

執行以下 SQL 來驗證：

```sql
-- 檢查表是否存在
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'line_auth_codes'
);

-- 檢查函數是否存在
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_line_auth_code_used', 'mark_line_auth_code_used', 'cleanup_expired_line_auth_codes');
```

## 工作原理

1. **檢查階段**：當收到授權碼時，Edge Function 會先檢查 `line_auth_codes` 表
2. **如果已使用**：直接返回 `code_already_used` 錯誤，不進行任何處理
3. **如果未使用**：繼續處理授權碼，交換 token，建立 session
4. **標記階段**：成功處理後，將授權碼標記為已使用

## 優點

- ✅ **防止重複處理**：從根本上避免 `code_already_used` 錯誤
- ✅ **提高安全性**：防止授權碼被重複使用
- ✅ **自動過期**：授權碼記錄會在 10 分鐘後自動過期
- ✅ **性能優化**：使用索引快速查找

## 注意事項

- 授權碼記錄會在 10 分鐘後自動過期（可以通過 `cleanup_expired_line_auth_codes()` 函數手動清理）
- 如果 migration 失敗，Edge Function 會繼續正常工作（會記錄警告日誌）
- 建議定期清理過期的授權碼記錄（可以設置定時任務）

## 下一步

執行 migration 後，Edge Function 已經更新並部署，會自動使用 single-use policy。
