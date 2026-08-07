/**
 * Facebook Page posting client — Graph API POST /{page-id}/feed.
 * https://developers.facebook.com/docs/pages-api/posts
 *
 * Required Edge Function secrets (see docs/SOCIAL_BOT_SETUP.md):
 *   Live:  FACEBOOK_PAGE_ACCESS_TOKEN, FACEBOOK_PAGE_ID
 *   Test:  TEST_FACEBOOK_PAGE_ACCESS_TOKEN, TEST_FACEBOOK_PAGE_ID
 */

import type { PlatformPostResult } from "./twitterPost.ts";

const GRAPH_API_VERSION = "v19.0";

export async function postToFacebook(options: { content: string; testMode: boolean }): Promise<PlatformPostResult> {
  const prefix = options.testMode ? "TEST_" : "";
  const accessToken = Deno.env.get(`${prefix}FACEBOOK_PAGE_ACCESS_TOKEN`);
  const pageId = Deno.env.get(`${prefix}FACEBOOK_PAGE_ID`);

  if (!accessToken || !pageId) {
    return { success: false, error: `Missing ${prefix}FACEBOOK_PAGE_ACCESS_TOKEN / ${prefix}FACEBOOK_PAGE_ID secrets` };
  }

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/feed`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: options.content, access_token: accessToken }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      return { success: false, error: `Facebook API HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}` };
    }

    return { success: true, externalId: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
