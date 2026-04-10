-- Baseline admin permissions for backend manager pages.
-- Goal: prevent environment drift from manual SQL patches.

-- =========================
-- contact_messages
-- =========================
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own contact messages" ON public.contact_messages;
CREATE POLICY "Users can view own contact messages"
ON public.contact_messages
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own contact messages" ON public.contact_messages;
CREATE POLICY "Users can insert own contact messages"
ON public.contact_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all contact messages" ON public.contact_messages;
CREATE POLICY "Admins can view all contact messages"
ON public.contact_messages
FOR SELECT
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update contact messages" ON public.contact_messages;
CREATE POLICY "Admins can update contact messages"
ON public.contact_messages
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON TABLE public.contact_messages TO authenticated;
GRANT ALL ON TABLE public.contact_messages TO service_role;

-- =========================
-- contact_message_replies
-- =========================
ALTER TABLE public.contact_message_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage contact message replies" ON public.contact_message_replies;
CREATE POLICY "Admins manage contact message replies"
ON public.contact_message_replies
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view contact message replies" ON public.contact_message_replies;
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

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contact_message_replies TO authenticated;
GRANT ALL ON TABLE public.contact_message_replies TO service_role;

-- =========================
-- notifications
-- =========================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view notifications" ON public.notifications;
CREATE POLICY "Admins can view notifications"
ON public.notifications
FOR SELECT
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
CREATE POLICY "Admins can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all notifications" ON public.notifications;
CREATE POLICY "Admins can update all notifications"
ON public.notifications
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "Admins can delete notifications"
ON public.notifications
FOR DELETE
USING (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

-- =========================
-- user_restrictions
-- =========================
ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own restrictions" ON public.user_restrictions;
CREATE POLICY "Users can view own restrictions"
ON public.user_restrictions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage user restrictions" ON public.user_restrictions;
CREATE POLICY "Admins can manage user restrictions"
ON public.user_restrictions
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_restrictions TO authenticated;
GRANT ALL ON TABLE public.user_restrictions TO service_role;

-- =========================
-- security manager tables
-- =========================
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage user blocks" ON public.user_blocks;
CREATE POLICY "Admins can manage user blocks"
ON public.user_blocks
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_blocks TO authenticated;

ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage ip blacklist" ON public.ip_blacklist;
CREATE POLICY "Admins can manage ip blacklist"
ON public.ip_blacklist
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ip_blacklist TO authenticated;

ALTER TABLE public.sensitive_words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage sensitive words" ON public.sensitive_words;
CREATE POLICY "Admins can manage sensitive words"
ON public.sensitive_words
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sensitive_words TO authenticated;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (public.is_admin(auth.uid()));
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
