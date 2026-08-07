/**
 * X (Twitter) posting client — POST /2/tweets via OAuth 1.0a user context.
 * v2 tweet creation requires OAuth1.0a (or OAuth2 user-context with tweet.write scope);
 * OAuth1.0a is used here since it doesn't require a refresh-token flow.
 *
 * Required Edge Function secrets (see docs/SOCIAL_BOT_SETUP.md):
 *   Live:  TWITTER_POST_API_KEY, TWITTER_POST_API_SECRET,
 *          TWITTER_POST_ACCESS_TOKEN, TWITTER_POST_ACCESS_SECRET
 *   Test:  TEST_TWITTER_POST_API_KEY, TEST_TWITTER_POST_API_SECRET,
 *          TEST_TWITTER_POST_ACCESS_TOKEN, TEST_TWITTER_POST_ACCESS_SECRET
 */

export type PlatformPostResult = {
  success: boolean;
  externalId?: string;
  error?: string;
};

const TWEETS_URL = "https://api.twitter.com/2/tweets";

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function hmacSha1Base64(baseString: string, signingKey: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(baseString));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function buildOAuth1Header(params: {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
}): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: params.accessToken,
    oauth_version: "1.0",
  };

  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join("&");

  const baseString = [
    params.method.toUpperCase(),
    percentEncode(params.url),
    percentEncode(paramString),
  ].join("&");

  const signingKey = `${percentEncode(params.consumerSecret)}&${percentEncode(params.accessSecret)}`;
  const signature = await hmacSha1Base64(baseString, signingKey);

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerString = Object.keys(headerParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
    .join(", ");

  return `OAuth ${headerString}`;
}

export async function postToX(options: { content: string; testMode: boolean }): Promise<PlatformPostResult> {
  const prefix = options.testMode ? "TEST_" : "";
  const consumerKey = Deno.env.get(`${prefix}TWITTER_POST_API_KEY`);
  const consumerSecret = Deno.env.get(`${prefix}TWITTER_POST_API_SECRET`);
  const accessToken = Deno.env.get(`${prefix}TWITTER_POST_ACCESS_TOKEN`);
  const accessSecret = Deno.env.get(`${prefix}TWITTER_POST_ACCESS_SECRET`);

  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) {
    return { success: false, error: `Missing ${prefix}TWITTER_POST_* secrets` };
  }

  try {
    const authHeader = await buildOAuth1Header({
      method: "POST",
      url: TWEETS_URL,
      consumerKey,
      consumerSecret,
      accessToken,
      accessSecret,
    });

    const res = await fetch(TWEETS_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: options.content }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: `X API HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}` };
    }

    return { success: true, externalId: data?.data?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
