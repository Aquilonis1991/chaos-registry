import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * OAuthCallbackPage - Bridge Page for Mobile App Social Login
 * 1. Receives Supabase Hash (#access_token=...)
 * 2. Converts to Deep Link (votechaos://auth/callback?access_token=...)
 * 3. Auto-redirects to App
 * 4. Provides Manual Fallback Button
 */
export const OAuthCallbackPage = () => {
  const [status, setStatus] = useState('初始化...');
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // 1. Get Hash or Search Params
    const hash = window.location.hash.substring(1); // Remove #
    const query = window.location.search.substring(1); // Remove ?

    // Combine them (Supabase usually sends hash, but we support both)
    const params = new URLSearchParams(hash || query);

    // Check if we have tokens
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const code = params.get('code');
    const error = params.get('error');

    if (accessToken || refreshToken || code || error) {
      setStatus('正在開啟應用程式...');

      // 2. Construct Deep Link
      // We convert Hash params to Query params for the Android App to parse easily
      const appScheme = 'votechaos://auth/callback';
      const finalLink = `${appScheme}?${params.toString()}`;

      console.log('[Bridge] Target Deep Link:', finalLink);
      setDeepLink(finalLink);

      // 3. Auto Redirect
      // Use a slight delay to allow UI to render
      setTimeout(() => {
        window.location.href = finalLink;
      }, 500);

    } else {
      // No tokens found
      setStatus('未偵測到登入資訊');
      console.warn('[Bridge] No tokens found in URL');
    }
  }, []);

  const handleManualClick = () => {
    if (deepLink) {
      window.location.href = deepLink;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-white">
      <div className="flex flex-col items-center space-y-6 text-center max-w-md w-full">

        {/* Status Icon */}
        <div className="p-4 bg-slate-800 rounded-full">
          <Loader2 className="h-10 w-10 animate-spin text-primary" color="#3b82f6" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight">
          {deepLink ? '正在登入 VoteChaos...' : '驗證中...'}
        </h1>

        {/* Status Text */}
        <p className="text-slate-400">
          {status}
        </p>

        {/* Manual Button (Always visible if link exists, in case auto-redirect fails) */}
        {deepLink && (
          <button
            onClick={handleManualClick}
            className="mt-8 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-lg w-full transition-all shadow-lg active:scale-95"
          >
            開啟 App
          </button>
        )}

        <div className="mt-8 p-4 bg-slate-900 rounded-lg text-xs text-left w-full overflow-hidden text-slate-500 font-mono">
          <div className="mb-1 font-bold text-slate-400">DEBUG INFO:</div>
          <div className="truncate">Ready: {deepLink ? 'YES' : 'NO'}</div>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
