import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "anon_device_id";
const SIGNUP_SRC_KEY = "vote_signup_src";

export type VoteBreakdownRow = {
  option_id: string;
  anon_votes: number;
  member_votes: number;
};

export function rememberVoteSignupSrc(src: string) {
  try {
    sessionStorage.setItem(SIGNUP_SRC_KEY, src || "direct");
  } catch {
    /* private mode may block sessionStorage */
  }
}

export function consumeVoteSignupSrc(): string | null {
  try {
    const src = sessionStorage.getItem(SIGNUP_SRC_KEY);
    if (src) sessionStorage.removeItem(SIGNUP_SRC_KEY);
    return src;
  } catch {
    return null;
  }
}

export function trackVoteEvent(name: "vote_view" | "anon_vote_submit" | "signup_from_vote", src: string) {
  const detail = { src: src || "direct" };
  const w = window as Window & {
    dataLayer?: Array<Record<string, unknown>>;
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
    gtag?: (...args: unknown[]) => void;
  };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event: name, ...detail });
  w.plausible?.(name, { props: detail });
  w.gtag?.("event", name, detail);
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY) || readCookie(DEVICE_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    localStorage.setItem(DEVICE_KEY, existing);
    writeCookie(DEVICE_KEY, existing);
    return existing;
  }
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, id);
  writeCookie(DEVICE_KEY, id);
  return id;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getFingerprintHash(): Promise<string> {
  const FingerprintJS = (await import("@fingerprintjs/fingerprintjs")).default;
  const agent = await FingerprintJS.load();
  const result = await agent.get();
  return sha256Hex(result.visitorId);
}

export async function fetchVoteBreakdown(topicId: string): Promise<VoteBreakdownRow[]> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, string>,
  ) => Promise<{ data: VoteBreakdownRow[] | null; error: { message: string } | null }>)(
    "get_topic_vote_breakdown",
    { p_topic_id: topicId },
  );
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function submitAnonVote(input: {
  topicId: string;
  optionId: string;
  src: string;
  threadsPostId?: string;
  turnstileToken: string;
}): Promise<{ ok: true; breakdown: VoteBreakdownRow[] } | { ok: false; error: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const [deviceId, fingerprintHash] = await Promise.all([
    Promise.resolve(getOrCreateDeviceId()),
    getFingerprintHash(),
  ]);
  const res = await fetch(`${supabaseUrl}/functions/v1/cast-anon-vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      topic_id: input.topicId,
      option_id: input.optionId,
      device_id: deviceId,
      fingerprint_hash: fingerprintHash,
      src: input.src,
      threads_post_id: input.threadsPostId || "",
      turnstile_token: input.turnstileToken,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: String(body?.error || "request_failed") };
  return { ok: true, breakdown: body.breakdown ?? [] };
}
