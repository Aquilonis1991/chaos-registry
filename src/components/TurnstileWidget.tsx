import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => void;
};

export function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const hostRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey || !hostRef.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !hostRef.current) return;
      (window as Window & { turnstile?: TurnstileApi }).turnstile?.render(hostRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenRef.current(token),
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="1"]');
    if ((window as Window & { turnstile?: TurnstileApi }).turnstile) {
      render();
      return;
    }
    const script = existing ?? document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.turnstile = "1";
    script.addEventListener("load", render);
    if (!existing) document.head.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  if (!siteKey) {
    return <p className="text-xs text-muted-foreground text-center">匿名投票驗證尚未設定</p>;
  }
  return <div ref={hostRef} className="flex justify-center" />;
}
