-- 支援聯絡訊息多次回覆與前端回覆列表
BEGIN;

-- 建立聯絡訊息回覆表
CREATE TABLE IF NOT EXISTS public.contact_message_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.contact_messages(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responder_role text NOT NULL CHECK (responder_role IN ('admin', 'user')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_message_replies_message_id
  ON public.contact_message_replies(message_id);

ALTER TABLE public.contact_message_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage contact message replies" ON public.contact_message_replies;
DROP POLICY IF EXISTS "Users view contact message replies" ON public.contact_message_replies;

CREATE POLICY "Admins manage contact message replies"
  ON public.contact_message_replies
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users view contact message replies"
  ON public.contact_message_replies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.contact_messages cm
      WHERE cm.id = contact_message_replies.message_id
        AND cm.user_id = auth.uid()
    )
    OR contact_message_replies.responder_id = auth.uid()
  );

-- 重新建立管理員查詢聯絡訊息函式，附帶回覆紀錄
DROP FUNCTION IF EXISTS public.admin_list_contact_messages();

CREATE OR REPLACE FUNCTION public.admin_list_contact_messages()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  category text,
  title text,
  content text,
  status text,
  admin_response text,
  admin_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_nickname text,
  user_email text,
  replies jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    cm.id,
    cm.user_id,
    cm.category,
    cm.title,
    cm.content,
    cm.status,
    cm.admin_response,
    cm.admin_id,
    cm.created_at,
    cm.updated_at,
    p.nickname AS user_nickname,
    au.email::text AS user_email,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'message_id', r.message_id,
            'responder_id', r.responder_id,
            'responder_role', r.responder_role,
            'content', r.content,
            'created_at', r.created_at,
            'responder_name', COALESCE(ap.nickname, au_admin.email::text)
          )
          ORDER BY r.created_at ASC
        )
        FROM public.contact_message_replies r
        LEFT JOIN public.profiles ap ON ap.id = r.responder_id
        LEFT JOIN auth.users au_admin ON au_admin.id = r.responder_id
        WHERE r.message_id = cm.id
      ),
      '[]'::jsonb
    ) AS replies
  FROM public.contact_messages cm
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  LEFT JOIN auth.users au ON au.id = cm.user_id
  ORDER BY cm.created_at DESC;
END;
$$;

-- 建立管理員回覆聯絡訊息函式
DROP FUNCTION IF EXISTS public.admin_reply_contact_message(uuid, text, text);

CREATE OR REPLACE FUNCTION public.admin_reply_contact_message(
  p_message_id uuid,
  p_content text,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_message public.contact_messages%ROWTYPE;
  v_reply_id uuid;
  v_next_status text;
BEGIN
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL OR NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_content IS NULL OR trim(p_content) = '' THEN
    RAISE EXCEPTION 'Reply content is required';
  END IF;

  SELECT * INTO v_message
  FROM public.contact_messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact message % not found', p_message_id;
  END IF;

  INSERT INTO public.contact_message_replies (message_id, responder_id, responder_role, content)
  VALUES (p_message_id, v_admin_id, 'admin', trim(p_content))
  RETURNING id INTO v_reply_id;

  v_next_status := COALESCE(
    p_status,
    CASE
      WHEN v_message.status = 'pending' THEN 'in_progress'
      ELSE v_message.status
    END
  );

  UPDATE public.contact_messages
  SET
    status = v_next_status,
    admin_id = v_admin_id,
    admin_response = trim(p_content),
    updated_at = now()
  WHERE id = p_message_id;

  IF v_message.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, content, created_by)
    VALUES (
      v_message.user_id,
      'contact',
      '客服回覆',
      trim(p_content),
      v_admin_id
    );
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id', r.id,
      'message_id', r.message_id,
      'responder_id', r.responder_id,
      'responder_role', r.responder_role,
      'content', r.content,
      'created_at', r.created_at
    )
    FROM public.contact_message_replies r
    WHERE r.id = v_reply_id
  );
END;
$$;

-- 使用者查詢客服回覆
DROP FUNCTION IF EXISTS public.user_list_contact_replies();

CREATE OR REPLACE FUNCTION public.user_list_contact_replies()
RETURNS TABLE (
  message_id uuid,
  message_title text,
  message_category text,
  message_created_at timestamptz,
  reply_id uuid,
  reply_content text,
  reply_created_at timestamptz,
  responder_id uuid,
  responder_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id AS message_id,
    cm.title AS message_title,
    cm.category AS message_category,
    cm.created_at AS message_created_at,
    r.id AS reply_id,
    r.content AS reply_content,
    r.created_at AS reply_created_at,
    r.responder_id,
    COALESCE(ap.nickname, au.email::text) AS responder_name
  FROM public.contact_messages cm
  JOIN public.contact_message_replies r ON r.message_id = cm.id
  LEFT JOIN public.profiles ap ON ap.id = r.responder_id
  LEFT JOIN auth.users au ON au.id = r.responder_id
  WHERE cm.user_id = auth.uid()
    AND r.responder_role = 'admin'
  ORDER BY r.created_at DESC;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;

