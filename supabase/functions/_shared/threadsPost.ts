/**
 * Threads posting client — Meta Threads API two-step publish
 * (create a media container, then publish it).
 * https://developers.facebook.com/docs/threads
 *
 * Required Edge Function secrets (see docs/SOCIAL_BOT_SETUP.md):
 *   Live:  THREADS_ACCESS_TOKEN, THREADS_USER_ID
 *   Test:  TEST_THREADS_ACCESS_TOKEN, TEST_THREADS_USER_ID
 */

import type { PlatformPostResult } from "./twitterPost.ts";

const THREADS_API_BASE = "https://graph.threads.net/v1.0";

export async function postToThreads(options: { content: string; testMode: boolean }): Promise<PlatformPostResult> {
  const prefix = options.testMode ? "TEST_" : "";
  const accessToken = Deno.env.get(`${prefix}THREADS_ACCESS_TOKEN`);
  const userId = Deno.env.get(`${prefix}THREADS_USER_ID`);

  if (!accessToken || !userId) {
    return { success: false, error: `Missing ${prefix}THREADS_ACCESS_TOKEN / ${prefix}THREADS_USER_ID secrets` };
  }

  try {
    const createUrl = new URL(`${THREADS_API_BASE}/${userId}/threads`);
    createUrl.searchParams.set("media_type", "TEXT");
    createUrl.searchParams.set("text", options.content);
    createUrl.searchParams.set("access_token", accessToken);

    const createRes = await fetch(createUrl.toString(), { method: "POST" });
    const createData = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !createData?.id) {
      return { success: false, error: `Threads create HTTP ${createRes.status}: ${JSON.stringify(createData).slice(0, 300)}` };
    }

    const publishUrl = new URL(`${THREADS_API_BASE}/${userId}/threads_publish`);
    publishUrl.searchParams.set("creation_id", createData.id);
    publishUrl.searchParams.set("access_token", accessToken);

    const publishRes = await fetch(publishUrl.toString(), { method: "POST" });
    const publishData = await publishRes.json().catch(() => ({}));
    if (!publishRes.ok || !publishData?.id) {
      return { success: false, error: `Threads publish HTTP ${publishRes.status}: ${JSON.stringify(publishData).slice(0, 300)}` };
    }

    return { success: true, externalId: publishData.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
