// Social Bot Phase 1: AI-generate promo copy for X / Threads / Facebook, moderate it,
// then post it. Split into two explicit steps so an admin reviews before anything goes
// out: action="generate" drafts content only (no posting, no DB log); action="publish"
// takes the (possibly admin-edited) draft text and actually posts it — to sandbox/test
// credentials when mode="test", to prod credentials when mode="live". Manually triggered
// from the admin "宣傳機器人" tab (SocialBotManager.tsx).
// Phase 2 (not built yet) will call action="publish" with mode="live" from a pg_cron job,
// the same way process-ended-topics-closing is scheduled.

import { createClient } from "npm:@supabase/supabase-js@2";
import { xaiChatCompletion } from "../_shared/xai.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { postToX } from "../_shared/twitterPost.ts";
import { postToThreads } from "../_shared/threadsPost.ts";
import { postToFacebook } from "../_shared/facebookPost.ts";

const SITE_BASE_URL = "https://chaosregistry.com";

// 輪替內容角度：每次生成隨機挑一個，避免每篇貼文都長得一樣、也讓帳號內容有變化。
const CONTENT_ANGLES = [
  "荒謬日常二選一：把生活中的小情境包裝成誇張、非黑即白的選擇題",
  "時事不理性觀點：對最近大家在討論的現象發表誇張、不理性的看法，邀請大家反駁",
  "戰貼引戰：故意講一個有爭議、容易讓人想留言反駁的立場",
  "深夜廢話：像是半夜睡不著隨口碎念的語氣，突然話鋒一轉帶到投票",
  "自嘲耍廢：拿自己（帳號本身）的耍廢、廢文屬性開玩笑",
  "導流型：呼應 App 裡剛好正在發生的討論，用「留言已經吵起來了」這種語氣邀請圍觀/參戰",
  "匿名爆料感：用「聽說」「內部消息」這種吊胃口的語氣包裝話題",
];

// 補充理由（不是結構規定）：Threads 的推播權重看「留言數」遠高於「按讚數」（約 5-10 倍），
// 結尾留一個會讓人想回覆的鉤子比單純曝光更重要——但具體怎麼寫、要不要用範例句型，交給
// system_config 的品牌語氣 prompt 決定，這裡不重複規定結構，避免跟 admin 自訂的寫作規則打架。
const STRUCTURE_RULE = `[背景知識，非結構規定]Threads 的推播權重看留言數遠高於按讚數，所以貼文的目的是引發對話、讓人想留言回應，不是單純曝光；實際要怎麼開頭、怎麼收尾，照上面 system prompt 的寫作規則走。`;

type Platform = "x" | "threads" | "facebook";
const ALL_PLATFORMS: Platform[] = ["x", "threads", "facebook"];
// 只列平台技術上限（超過會直接發文失敗），不規定風格用的建議長度——那個交給 system_config
// 的品牌語氣 prompt 自己決定（例如目前設定的 80-120 字），避免兩邊長度指示互相矛盾。
const PLATFORM_LENGTH_HINT: Record<Platform, string> = {
  x: "技術上限 280 字元（系統附加的連結不算在內）",
  threads: "技術上限 500 字元（系統附加的連結不算在內）",
  facebook: "無嚴格技術上限，但請以品牌語氣 prompt 指定的長度為準",
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

async function checkBanned(supabaseAdmin: ReturnType<typeof createClient>, content: string): Promise<{ blocked: boolean; reason?: string }> {
  const { data: bannedRows, error: bannedError } = await supabaseAdmin.rpc("check_banned_words", {
    p_text: content,
    p_check_levels: ["A", "B", "C", "D", "E", "F"],
  });
  const hit = Array.isArray(bannedRows) && bannedRows.length > 0 ? bannedRows[0] as any : null;
  if (bannedError) return { blocked: true, reason: `違禁字檢查失敗：${bannedError.message}` };
  if (hit?.found && (hit.action === "block" || hit.action === "review")) {
    return { blocked: true, reason: `含${hit.action === "block" ? "禁止" : "需審核"}字詞：${hit.keyword}` };
  }
  return { blocked: false };
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const { action = "generate", mode, platforms, content: providedContent, lang = "zh" } = await req.json();

    if (action !== "generate" && action !== "publish") {
      throw new Error('action 必須是 "generate" 或 "publish"');
    }
    if (action === "publish" && mode !== "test" && mode !== "live") {
      throw new Error('publish 時 mode 必須是 "test" 或 "live"');
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

    // ── action = "generate"：只生成草稿、跑違禁字檢查，不發文、不寫入 social_bot_posts ──
    if (action === "generate") {
      const systemPrompt = promptByLang[lang] || promptByLang.zh || promptByLang.en || "";
      if (!systemPrompt) {
        throw new Error("social_bot_prompt 尚未設定，請先在後台「AI 管理」或社群機器人分頁填寫");
      }

      const lengthRules = targetPlatforms
        .map((p) => `- ${p}: ${PLATFORM_LENGTH_HINT[p]}（如果有填 topic_id，系統會在文末額外附加一則約 40-50 字元的連結，這個長度不算在上面限制內，但寫 content 時請留一點餘裕，不要卡在上限）`)
        .join("\n");
      const outputSchema = targetPlatforms
        .map((p) => `"${p}": {"content": "string，不要自己加連結，連結由系統自動附加", "topic_id": number 或 null}`)
        .join(", ");

      // 搭上潮流：從目前 App 內討論度最高的話題取幾則，讓 AI 從中挑一個自然帶入文案，
      // 而不是單純寫空泛的品牌推廣文。沿用首頁「熱門」分頁同一套排序（get_hot_topics_with_exposure），
      // 該 RPC 不依賴 auth.uid()，service role 可直接呼叫。
      // 注意：這支 RPC 是給首頁「熱門」分頁用的，status 會包含 'active' 跟 'ended'（含寬限期），
      // 熱度分數看的是累積票數，快結束但票數多的主題反而容易排前面——這對「邀請大家來投票」
      // 的宣傳用途是反效果（來不及投票）。所以多抓一些候選（15 筆），篩掉已結束、或剩不到
      // 2 小時就要結束的主題，再從篩完的結果取前 3 個。
      const { data: hotTopics, error: hotTopicsError } = await supabaseAdmin.rpc(
        "get_hot_topics_with_exposure",
        { p_limit: 15, p_offset: 0, p_grace_days: null }
      );
      if (hotTopicsError) {
        console.error("[social-post-bot] get_hot_topics_with_exposure error:", hotTopicsError);
      }
      const MIN_HOURS_REMAINING = 2;
      const now = Date.now();
      const trendingTopics = (hotTopics || [])
        .filter((t: any) => t?.id && t?.title && t.status === "active")
        .filter((t: any) => {
          if (!t.end_at) return true;
          const hoursLeft = (new Date(t.end_at).getTime() - now) / (1000 * 60 * 60);
          return hoursLeft >= MIN_HOURS_REMAINING;
        })
        .slice(0, 3);
      const trendHint = trendingTopics.length > 0
        ? `\n\n[參考靈感，是否引用非必須]以下是目前 App 內討論度最高的話題，僅供靈感參考，每行格式是「編號 | 話題標題（票數）」：\n${trendingTopics
            .map((t: any, i: number) => `${i + 1} | ${t.title}（目前 ${t.total_votes ?? 0} 票）`)
            .join("\n")}\n要不要提到這些話題完全隨意，不適合就別硬塞，維持原本品牌語氣自由發揮即可。連結不用你自己寫，系統會自動附加在貼文最後，所以 content 欄位裡絕對不要自己寫任何網址、也不要在文字裡寫「1」「2」這種編號。這則自動附加的純網址不算 CTA 或連結說明句，跟上面「不要寫 CTA」的規則不衝突，不用因此不敢填 topic_id。【規則】如果這篇文案的內容有引用、暗示、或改寫上面任何一則，就在 "topic_id" 欄位填入該話題前面的編號（純數字，例如 1、2 或 3，不要加任何文字或符號）；完全沒引用任何一則就填 null。`
        : "";

      // 讓發文有連貫感：抓最近幾則「真的發布成功」的貼文（只看 live，不看 test，避免拿測試帳號的
      // 內容當記憶），給 AI 當作近期記憶，避免炒冷飯、也讓它有機會自然呼應之前的哏。
      const { data: recentPosts, error: recentPostsError } = await supabaseAdmin
        .from("social_bot_posts")
        .select("platform, content, created_at")
        .eq("mode", "live")
        .eq("status", "posted")
        .order("created_at", { ascending: false })
        .limit(5);
      if (recentPostsError) {
        console.error("[social-post-bot] fetch recent posts error:", recentPostsError);
      }
      const historyHint = recentPosts && recentPosts.length > 0
        ? `\n\n[近期發文記憶]以下是最近幾則已經正式發布過的貼文，請避免重複一樣的哏、句型或用字；如果適合可以自然呼應、延續之前提過的梗或話題，讓帳號整體風格有連貫感，但不用每篇都硬要接續：\n${recentPosts
            .map((p: any) => `- [${p.platform}] ${p.content}`)
            .join("\n")}`
        : "";

      // 固定人設：不管品牌語氣文字怎麼調，這條規則都要套用，確保帳號讀起來像同一個角色在講話。
      const personaHint = "\n\n[人設一致性，強制規則]想像自己是同一個固定角色在經營這個帳號——語氣、口頭禪、態度前後要一致，不要這篇正經、下一篇又變成完全不同的人格。";

      // 輪替內容角度：隨機挑一個，寫進 prompt 指定這次要用的角度。
      const chosenAngle = CONTENT_ANGLES[Math.floor(Math.random() * CONTENT_ANGLES.length)];
      const angleHint = `\n\n[本次內容角度]${chosenAngle}。`;

      const aiData = await xaiChatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `請針對以下平台各寫一篇推廣貼文，長度限制：\n${lengthRules}\n\n${STRUCTURE_RULE}${trendHint}${historyHint}${personaHint}${angleHint}\n\n只輸出 JSON，格式為 {${outputSchema}}，不要有其他說明文字或 markdown 標記。`,
          },
        ],
        temperature: 0.9,
        response_format: { type: "json_object" },
      });
      if (aiData.error) throw new Error(aiData.error.message);

      let resultText = aiData.choices?.[0]?.message?.content;
      if (!resultText) throw new Error(`Invalid AI response structure (Raw: ${JSON.stringify(aiData)})`);
      resultText = resultText.replace(/```json\n?|```/g, "").trim();
      const generated: Record<string, { content?: string; topic_id?: string | number | null }> = JSON.parse(resultText);

      const results: ResultRow[] = [];
      for (const platform of targetPlatforms) {
        const entry = generated[platform];
        let content = (entry?.content || "").trim();
        if (!content) {
          results.push({ platform, status: "failed", content: "", error: "AI 未產生此平台的內容" });
          continue;
        }
        // 連結由程式碼依 AI 回傳的 topic_id（清單裡的 1-based 編號，不是話題的真實 UUID——
        // UUID 太長太容易被 AI 抄錯/截斷，改用簡單數字大幅降低出錯機率）決定性地附加，
        // 不依賴 AI 有沒有把連結寫進文字本身。
        const idx = entry?.topic_id != null ? Number(entry.topic_id) : NaN;
        const referencedTopic = Number.isInteger(idx) && idx >= 1 && idx <= trendingTopics.length
          ? trendingTopics[idx - 1]
          : undefined;
        if (referencedTopic) {
          content = `${content}\n${SITE_BASE_URL}/vote/${referencedTopic.id}`;
        }
        const { blocked, reason } = await checkBanned(supabaseAdmin, content);
        results.push({ platform, content, status: blocked ? "blocked" : "generated", error: reason });
      }

      return new Response(JSON.stringify({ success: true, action: "generate", results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── action = "publish"：拿已審過（可能被管理員編輯過）的草稿內容，重新過一次違禁字檢查
    // 後才真的發文，並寫入 social_bot_posts 留紀錄。 ──
    if (!providedContent || typeof providedContent !== "object") {
      throw new Error("publish 需要提供 content（每個平台已確認要發布的文字）");
    }

    const results: ResultRow[] = [];
    for (const platform of targetPlatforms) {
      const content = (providedContent[platform] || "").trim();
      if (!content) {
        results.push({ platform, status: "failed", content: "", error: "沒有可發布的內容" });
        continue;
      }

      const { blocked, reason } = await checkBanned(supabaseAdmin, content);
      if (blocked) {
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

    return new Response(JSON.stringify({ success: true, action: "publish", mode, results }), {
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
