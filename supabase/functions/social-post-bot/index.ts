// Social Bot Phase 1: AI-generate promo copy for X / Threads / Facebook, moderate it,
// then post it — to sandbox/test credentials when mode="test", to prod credentials when
// mode="live". Manually triggered from the admin "社群機器人" tab (SocialBotManager.tsx).
// Phase 2 (not built yet) will call this with mode="live" from a pg_cron job, the same
// way process-ended-topics-closing is scheduled.

import { createClient } from "npm:@supabase/supabase-js@2";
import { xaiChatCompletion } from "../_shared/xai.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { postToX } from "../_shared/twitterPost.ts";
import { postToThreads } from "../_shared/threadsPost.ts";
import { postToFacebook } from "../_shared/facebookPost.ts";

const SITE_BASE_URL = "https://chaosregistry.com";

type Platform = "x" | "threads" | "facebook";
const ALL_PLATFORMS: Platform[] = ["x", "threads", "facebook"];
const PLATFORM_LENGTH_HINT: Record<Platform, string> = {
  x: "280 字元以內（含空白與 hashtag）",
  threads: "500 字元以內",
  facebook: "約 150-300 字元，適合閱讀的長度",
};
const PLATFORM_POSTERS: Record<Platform, (o: { content: string; testMode: boolean }) => Promise<{ success: boolean; externalId?: string; error?: string }>> = {
  x: postToX,
  threads: postToThreads,
  facebook: postToFacebook,
};

type ResultRow = {
  platform: Platform;
  status: "generated" | "blocked" | "posted" | "failed";
  content: string;
  externalId?: string;
  error?: string;
};

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const { mode, platforms, lang = "zh" } = await req.json();

    if (mode !== "test" && mode !== "live") {
      throw new Error('mode 必須是 "test" 或 "live"');
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { data: isAdmin, error: adminCheckError } = await supabase.rpc("is_admin", {
      check_user_id: user.id,
    });
    if (adminCheckError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    );

    const { data: configRows, error: configError } = await supabaseAdmin
      .from("system_config")
      .select("key, value")
      .in("key", ["social_bot_platforms", "social_bot_prompt"]);
    if (configError) throw configError;

    const configMap = new Map((configRows || []).map((r: any) => [r.key, r.value]));
    const enabledPlatforms: Record<string, boolean> = configMap.get("social_bot_platforms") || {};
    const promptByLang: Record<string, string> = configMap.get("social_bot_prompt") || {};

    const requestedPlatforms: Platform[] = Array.isArray(platforms) && platforms.length > 0
      ? platforms.filter((p: string): p is Platform => ALL_PLATFORMS.includes(p as Platform))
      : ALL_PLATFORMS;
    const targetPlatforms = requestedPlatforms.filter((p) => enabledPlatforms[p] !== false);

    if (targetPlatforms.length === 0) {
      throw new Error("沒有任何已啟用的平台可以發文（請檢查 social_bot_platforms 設定）");
    }

    const systemPrompt = promptByLang[lang] || promptByLang.zh || promptByLang.en || "";
    if (!systemPrompt) {
      throw new Error("social_bot_prompt 尚未設定，請先在後台「AI 管理」或社群機器人分頁填寫");
    }

    const lengthRules = targetPlatforms
      .map((p) => `- ${p}: ${PLATFORM_LENGTH_HINT[p]}`)
      .join("\n");
    const outputSchema = targetPlatforms.map((p) => `"${p}": "string"`).join(", ");

    // 搭上潮流：從目前 App 內討論度最高的話題取幾則，讓 AI 從中挑一個自然帶入文案，
    // 而不是單純寫空泛的品牌推廣文。沿用首頁「熱門」分頁同一套排序（get_hot_topics_with_exposure），
    // 該 RPC 不依賴 auth.uid()，service role 可直接呼叫。
    const { data: hotTopics, error: hotTopicsError } = await supabaseAdmin.rpc(
      "get_hot_topics_with_exposure",
      { p_limit: 3, p_offset: 0, p_grace_days: null }
    );
    if (hotTopicsError) {
      console.error("[social-post-bot] get_hot_topics_with_exposure error:", hotTopicsError);
    }
    const trendingTopics = (hotTopics || []).filter((t: any) => t?.id && t?.title);
    const trendHint = trendingTopics.length > 0
      ? `\n\n[搭上潮流]目前 App 內討論度最高的話題如下，請從中挑一個最適合、最有梗的話題自然帶入文案（提到話題重點並附上對應連結，連結直接照抄，不要竄改）：\n${trendingTopics
          .map((t: any) => `- 「${t.title}」（目前 ${t.total_votes ?? 0} 票）：${SITE_BASE_URL}/vote/${t.id}`)
          .join("\n")}`
      : "";

    const aiData = await xaiChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `請針對以下平台各寫一篇推廣貼文，長度限制：\n${lengthRules}${trendHint}\n\n只輸出 JSON，格式為 {${outputSchema}}，不要有其他說明文字或 markdown 標記。`,
        },
      ],
      temperature: 0.9,
      response_format: { type: "json_object" },
    });
    if (aiData.error) throw new Error(aiData.error.message);

    let resultText = aiData.choices?.[0]?.message?.content;
    if (!resultText) throw new Error(`Invalid AI response structure (Raw: ${JSON.stringify(aiData)})`);
    resultText = resultText.replace(/```json\n?|```/g, "").trim();
    const generated: Record<string, string> = JSON.parse(resultText);

    const results: ResultRow[] = [];

    for (const platform of targetPlatforms) {
      const content = (generated[platform] || "").trim();
      if (!content) {
        results.push({ platform, status: "failed", content: "", error: "AI 未產生此平台的內容" });
        continue;
      }

      const { data: bannedRows, error: bannedError } = await supabaseAdmin.rpc("check_banned_words", {
        p_text: content,
        p_check_levels: ["A", "B", "C", "D", "E", "F"],
      });
      const hit = Array.isArray(bannedRows) && bannedRows.length > 0 ? bannedRows[0] : null;
      const blocked = bannedError || (hit?.found && (hit.action === "block" || hit.action === "review"));

      if (blocked) {
        const reason = bannedError ? `違禁字檢查失敗：${bannedError.message}` : `含${hit.action === "block" ? "禁止" : "需審核"}字詞：${hit.keyword}`;
        results.push({ platform, status: "blocked", content, error: reason });
        await supabaseAdmin.from("social_bot_posts").insert({
          platform, mode, content, status: "blocked", error: reason, created_by: user.id,
        });
        continue;
      }

      const postResult = await PLATFORM_POSTERS[platform]({ content, testMode: mode === "test" });
      const status = postResult.success ? "posted" : "failed";
      results.push({ platform, status, content, externalId: postResult.externalId, error: postResult.error });
      await supabaseAdmin.from("social_bot_posts").insert({
        platform, mode, content, status,
        external_post_id: postResult.externalId ?? null,
        error: postResult.error ?? null,
        created_by: user.id,
      });
    }

    return new Response(JSON.stringify({ success: true, mode, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[social-post-bot] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
