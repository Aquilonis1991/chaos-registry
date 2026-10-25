import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FP_RE = /^[0-9a-f]{64}$/i;
const SRC_RE = /^[a-z0-9_-]{1,32}$/;

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req.headers.get("origin"));

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  try {
    const body = await req.json().catch(() => null);
    const topicId = String(body?.topic_id || "");
    const optionId = String(body?.option_id || "").slice(0, 80);
    const deviceId = String(body?.device_id || "");
    const fingerprintHash = String(body?.fingerprint_hash || "").toLowerCase();
    const turnstileToken = String(body?.turnstile_token || "");
    const src = SRC_RE.test(String(body?.src || "")) ? String(body.src) : "direct";
    const threadsPostId = String(body?.threads_post_id || "").trim();

    if (!UUID_RE.test(topicId) || !optionId || !UUID_RE.test(deviceId) || !FP_RE.test(fingerprintHash)) {
      return json({ error: "invalid_input" }, 400, cors);
    }

    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!turnstileSecret) {
      return json({ error: "turnstile_not_configured" }, 503, cors);
    }
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: turnstileSecret, response: turnstileToken, remoteip: clientIp(req) }),
    });
    const verifyBody = await verify.json().catch(() => ({ success: false }));
    if (!verifyBody?.success) {
      return json({ error: "turnstile_failed" }, 403, cors);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const salt = Deno.env.get("ANON_VOTE_IP_SALT");
    if (!supabaseUrl || !serviceKey || !salt) {
      return json({ error: "server_not_configured" }, 503, cors);
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: topic, error: topicErr } = await supabase
      .from("topics")
      .select("id, status, end_at, options")
      .eq("id", topicId)
      .maybeSingle();
    if (topicErr || !topic) return json({ error: "topic_not_found" }, 404, cors);
    if (topic.status !== "active" || new Date(topic.end_at).getTime() <= Date.now()) {
      return json({ error: "topic_ended" }, 409, cors);
    }
    const options = Array.isArray(topic.options) ? topic.options : [];
    const optionOk = options.some((opt: { id?: string }, index: number) => {
      const id = opt?.id != null ? String(opt.id) : `option-${index}`;
      return id === optionId;
    });
    if (!optionOk) return json({ error: "option_not_found" }, 400, cors);

    const { data: dupDevice } = await supabase
      .from("anon_votes")
      .select("id")
      .eq("topic_id", topicId)
      .eq("device_id", deviceId)
      .maybeSingle();
    if (dupDevice) return json({ error: "already_voted" }, 409, cors);

    const { data: dupFp } = await supabase
      .from("anon_votes")
      .select("id")
      .eq("topic_id", topicId)
      .eq("fingerprint_hash", fingerprintHash)
      .maybeSingle();
    if (dupFp) return json({ error: "already_voted" }, 409, cors);

    const ipHash = await sha256Hex(`${clientIp(req)}|${salt}`);
    const { data: capRow } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "anon_vote_ip_cap_24h")
      .maybeSingle();
    const cap = Number(capRow?.value) || 5;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: ipCount } = await supabase
      .from("anon_votes")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topicId)
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((ipCount ?? 0) >= cap) {
      return json({ error: "ip_limited" }, 429, cors);
    }

    const { error: insertErr } = await supabase.from("anon_votes").insert({
      topic_id: topicId,
      option_id: optionId,
      device_id: deviceId,
      fingerprint_hash: fingerprintHash,
      ip_hash: ipHash,
      src,
    });
    if (insertErr) {
      if ((insertErr as { code?: string }).code === "23505") {
        return json({ error: "already_voted" }, 409, cors);
      }
      console.error("[cast-anon-vote] insert", insertErr.message);
      return json({ error: "insert_failed" }, 500, cors);
    }

    const { error: countErr } = await supabase.rpc("add_topic_option_votes", {
      p_topic_id: topicId,
      p_option_id: optionId,
      p_amount: 1,
    });
    if (countErr) {
      await supabase.from("anon_votes").delete().eq("topic_id", topicId).eq("device_id", deviceId);
      console.error("[cast-anon-vote] count", countErr.message);
      return json({ error: "insert_failed" }, 500, cors);
    }
    await supabase.from("anon_votes").update({ counted_in_topic: true }).eq("topic_id", topicId).eq("device_id", deviceId);

    if (/^\d{5,30}$/.test(threadsPostId)) {
      await supabase.from("topic_threads_posts").upsert(
        { topic_id: topicId, threads_media_id: threadsPostId, updated_at: new Date().toISOString() },
        { onConflict: "topic_id" },
      );
    }

    const { data: breakdown } = await supabase.rpc("get_topic_vote_breakdown", { p_topic_id: topicId });
    return json({ ok: true, breakdown: breakdown ?? [] }, 200, cors);
  } catch (err) {
    console.error("[cast-anon-vote]", err instanceof Error ? err.message : err);
    return json({ error: "internal" }, 500, cors);
  }
});
