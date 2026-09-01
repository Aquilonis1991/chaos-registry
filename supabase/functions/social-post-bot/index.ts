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

// 貼文結構規則：Threads 的推播權重看「留言數」遠高於「按讚數」（約 5-10 倍），所以貼文設計
// 目標是引發留言，不是單純曝光——結尾一定要留一個會讓人想回覆的鉤子，不能只是平鋪直敘介紹。
const STRUCTURE_RULE = `[貼文結構規則，強制]
1. 第一句：強 Hook——用逆向觀點、痛點場景、數字/反差衝突，或直接丟一個結論，抓住注意力。不要用「快來投票！」「馬上參與！」這種宣告式開頭。
2. 中間：2-4 句簡短觀點或場景描述，口語、有畫面感，不要寫成長文或懶人包。
3. 結尾：開放式問題、或二選一／多選一，一定要讓人「想留言回覆」，因為 Threads 的推播是看留言數決定廣度，遠比按讚重要，貼文目的是引發對話，不是單純曝光。
4. 禁止：長文、硬廣、過度正式或官腔的品牌口吻、「請問各位覺得呢？」這種空洞的弱問題。`;

// Few-shot 範例：示範上面結構規則實際寫出來長怎樣，幫助模型抓住語感。範例本身不代表真實數據。
const FEW_SHOT_EXAMPLES = `[範例參考風格，僅供語感參考，不要照抄內容]
- 荒謬日常：「我發現一件事：很多人下班後第一件事不是滑手機，是先打開冰箱發呆三十秒。你是哪一種？A. 冰箱發呆派 B. 直接躺平派 C. 通勤就已經累到不想動」
- 時事不理性觀點：「今天又看到一堆人在吵一件事。認真想了三秒，覺得最扯的其實是大家都很認真在吵一件根本不重要的事。你覺得這次吵得有意義，還是純粹解悶？」
- 導流型：「剛看到 App 裡有人發起一個超扯的投票題，留言已經吵起來了。有時候不理性投票比理性討論好玩多了。你最近最想發起什麼荒謬投票？」`;

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

// 保險機制：AI 有時會提到話題內容卻忘記附連結（即使 prompt 有強制規則）。這裡用粗略字串比對
// 補救——如果文案裡出現了某個熱門話題標題的開頭幾個字、但沒有附上對應連結，就自動補在文末。
function ensureTopicLinks(content: string, topics: Array<{ id: string; title: string }>): string {
  let result = content;
  for (const t of topics) {
    const url = `${SITE_BASE_URL}/vote/${t.id}`;
    if (result.includes(url)) continue;
    const title = String(t.title || "").trim();
    if (title.length < 4) continue;
    const probe = title.slice(0, Math.min(6, title.length));
    if (result.includes(probe)) {
      result = `${result}\n${url}`;
    }
  }
  return result;
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
        .map((p) => `- ${p}: ${PLATFORM_LENGTH_HINT[p]}`)
        .join("\n");
      const outputSchema = targetPlatforms.map((p) => `"${p}": "string"`).join(", ");

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
        ? `\n\n[參考靈感，是否引用非必須，但引用了就一定要附連結]以下是目前 App 內討論度最高的話題，僅供靈感參考：\n${trendingTopics
            .map((t: any) => `- 「${t.title}」（目前 ${t.total_votes ?? 0} 票）：${SITE_BASE_URL}/vote/${t.id}`)
            .join("\n")}\n要不要提到這些話題完全隨意，不適合就別硬塞，維持原本品牌語氣自由發揮即可。但【強制規則】只要文案內容提到了上面任何一個話題的名稱或內容（哪怕只是暗示、改寫、不是逐字照抄標題），就一定要把該話題對應的連結原封不動放進貼文裡，不能只提話題卻不附連結——沒有連結，讀者沒辦法點進去參與，這則貼文就失去意義了。連結不能竄改、不能縮短、不能省略 https://。`
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
            content: `請針對以下平台各寫一篇推廣貼文，長度限制：\n${lengthRules}\n\n${STRUCTURE_RULE}\n\n${FEW_SHOT_EXAMPLES}${trendHint}${historyHint}${personaHint}${angleHint}\n\n只輸出 JSON，格式為 {${outputSchema}}，不要有其他說明文字或 markdown 標記。`,
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
        let content = (generated[platform] || "").trim();
        if (!content) {
          results.push({ platform, status: "failed", content: "", error: "AI 未產生此平台的內容" });
          continue;
        }
        content = ensureTopicLinks(content, trendingTopics);
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
