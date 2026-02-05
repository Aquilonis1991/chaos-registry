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

    toast.info('RC: Handler Mounted', { duration: 2000 }); // Flight Recorder

    const handleOAuthCallback = async (event: CustomEvent<{ url: string; params?: Record<string, string> }>) => {
      toast.info('RC: Event Received', { duration: 3000 });
      console.log('[OAuthCallbackHandler] Event:', event.detail);

      if (isProcessing) {
        toast.warning('RC: Busy (Processing)', { duration: 2000 });
        return;
      }

      setIsProcessing(true);
      const { url, params = {} } = event.detail;

      // 1. Check for Tokens
      if (params.access_token && params.refresh_token) {
        toast.info('RC: Tokens Found. Setting Session...', { duration: 4000 });

        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });

          if (error) {
            console.error(error);
            toast.error(`RC: Session Error: ${error.message}`);
            setIsProcessing(false);
            return;
          }

          if (data.session) {
            toast.success('RC: Login Success! Redirecting...', { duration: 3000 });
            setTimeout(() => navigate('/home', { replace: true }), 500);
          } else {
            toast.error('RC: SetSession done but No Session?');
          }
        } catch (e: any) {
          toast.error(`RC: Exception: ${e.message}`);
        }
        setIsProcessing(false);
        return;
      }

      // 2. Check for Code (Twitter/Supabase PKCE flow usually returns code to Deep Link?)
      // Note: If using implicit flow, we expect tokens.

      toast.warning('RC: No Tokens in Params. Checking Code...');
      // ... (Existing logic for Code exchange if needed, but for now we focus on Token flow from Bridge)

      setIsProcessing(false);
    };

    window.addEventListener('oauth-callback', handleOAuthCallback as EventListener);

    const pendingCallback = getPendingOAuthCallback();
    if (pendingCallback) {
      toast.info(`RC: Buffer Found! ${pendingCallback.url.substring(0, 20)}...`, { duration: 4000 });
      window.dispatchEvent(new CustomEvent('oauth-callback', { detail: pendingCallback }));
      clearPendingOAuthCallback();
    } else {
      toast.info('RC: No Buffer', { duration: 2000 });
    }

    return () => {
      window.removeEventListener('oauth-callback', handleOAuthCallback as EventListener);
    };
  }, [navigate]);

  return null;
};

