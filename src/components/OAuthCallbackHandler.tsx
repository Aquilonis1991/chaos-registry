import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/capacitor";
import { toast } from "sonner";

import { getPendingOAuthCallback, clearPendingOAuthCallback } from "@/lib/app-lifecycle";

export const OAuthCallbackHandler = () => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const processedCallbacksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isNative()) return;

    const handleOAuthCallback = async (event: CustomEvent<{ url: string; params?: Record<string, string> }>) => {
      console.log('[OAuthCallbackHandler] Event:', event.detail);

      if (isProcessing) {
        return;
      }

      setIsProcessing(true);
      const { url, params = {} } = event.detail;

      // 1. Check for Tokens
      if (params.access_token && params.refresh_token) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });

          if (error) {
            console.error(error);
            toast.error(`Login Error: ${error.message}`);
            setIsProcessing(false);
            return;
          }

          if (data.session) {
            toast.success('Login Success!');
            setTimeout(() => navigate('/home', { replace: true }), 500);
          }
        } catch (e: any) {
          console.error(e);
          toast.error(`Login Exception: ${e.message}`);
        }
        setIsProcessing(false);
        return;
      }

      // 2. Check for Code (Exchange for Tokens)
      if (params.code) {
        // ... Code exchange logic if needed
        clearPendingOAuthCallback(); // Ensure buffer is cleared
        setIsProcessing(false);
        return;
      }

      // Always clear buffer if we processed an event, to prevent double-handling on remount
      clearPendingOAuthCallback();
      setIsProcessing(false);
    };

    window.addEventListener('oauth-callback', handleOAuthCallback as EventListener);

    const pendingCallback = getPendingOAuthCallback();
    if (pendingCallback) {
      console.log('[OAuthCallbackHandler] Processing Pending Buffer');
      window.dispatchEvent(new CustomEvent('oauth-callback', { detail: pendingCallback }));
      clearPendingOAuthCallback();
    }

    return () => {
      window.removeEventListener('oauth-callback', handleOAuthCallback as EventListener);
    };
  }, [navigate]);

  return null;
};

