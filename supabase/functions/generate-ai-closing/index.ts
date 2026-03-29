import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_ZH = "ChaosRegistry 已完成紀錄。";
const FALLBACK_EN = "ChaosRegistry has recorded this session.";
const FALLBACK_JA = "ChaosRegistry は記録を完了しました。";

const renderPromptTemplate = (template: string, vars: Record<string, string>) => {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body: { topic_id?: string } = {};
    try {
      body = await req.json();
    } catch (_) {}

    const topic_id = body?.topic_id;
    if (!topic_id) throw new Error("topic_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) throw new Error("Service role key not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    const cronSecret = req.headers.get("x-cron-secret");
    const isCron = !!cronSecret && cronSecret === Deno.env.get("CRON_SECRET");
    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Unauthorized");
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) throw new Error("Unauthorized");
    }

    // 1. Lock and fetch topic (use RPC for FOR UPDATE to prevent race)
    const { data: topicRow, error: topicErr } = await supabase
      .from("topics")
      .select("id, title, description, options, status, end_at, ai_summary_generated, duration_days")
      .eq("id", topic_id)
      .single();

    if (topicErr || !topicRow) throw new Error("Topic not found");

    const endAt = new Date(topicRow.end_at);
    const now = new Date();
    const isEnded = topicRow.status === "ended" || endAt <= now;

    if (!isEnded) {
      return new Response(JSON.stringify({ error: "Topic has not ended yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Update status to ended if still active
    if (topicRow.status === "active") {
      await supabase.from("topics").update({ status: "ended" }).eq("id", topic_id);
    }

    // 3. Check if already generated（回傳含三語欄位供前端依語言顯示）
    const { data: existing } = await supabase
      .from("topic_ai_summary")
      .select("id, content, content_zh, content_en, content_ja, created_at")
      .eq("topic_id", topic_id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, data: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (topicRow.ai_summary_generated === true) {
      const { data: existing2 } = await supabase
        .from("topic_ai_summary")
        .select("id, content, content_zh, content_en, content_ja, created_at")
        .eq("topic_id", topic_id)
        .maybeSingle();
      if (existing2) {
        return new Response(JSON.stringify({ success: true, data: existing2 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 4. Compute statistics
    // 付費／代幣投票在 votes 表；免費票（increment_free_vote 等）常只寫入 options[].votes，需兩邊加總。
    const options = (topicRow.options || []) as Array<string | { id?: string; text?: string; label?: string; votes?: number }>;
    type OptAcc = { optionId: string; name: string; jsonVotes: number; votes: number };
    const optList: OptAcc[] = options
      .map((o, idx) => {
        const name = typeof o === "string" ? o : (o?.text ?? o?.label ?? "");
        const optionId = typeof o === "object" && o && typeof (o as any).id === "string" && (o as any).id.trim().length > 0
          ? String((o as any).id)
          : `option-${idx}`;
        const jv =
          typeof o === "object" && o != null && typeof (o as any).votes === "number" && Number.isFinite((o as any).votes)
            ? Math.max(0, Math.floor(Number((o as any).votes)))
            : 0;
        return { optionId, name, jsonVotes: jv, votes: 0 };
      })
      .filter((o) => o.name.trim().length > 0);

    const { data: voteAgg, error: voteAggErr } = await supabase
      .from("votes")
      .select("option, amount")
      .eq("topic_id", topic_id);
    if (voteAggErr) console.warn("[generate-ai-closing] votes aggregate error:", voteAggErr);

    const voteMap = new Map<string, number>();
    for (const r of (voteAgg || []) as Array<{ option: string; amount: number }>) {
      const key = String(r.option ?? "");
      const amt = Number(r.amount ?? 0);
      if (!key) continue;
      voteMap.set(key, (voteMap.get(key) ?? 0) + (Number.isFinite(amt) ? amt : 0));
    }

    for (const o of optList) {
      o.votes = (voteMap.get(o.optionId) ?? 0) + o.jsonVotes;
    }

    const tableAllIdMiss = voteMap.size > 0 && optList.every((o) => (voteMap.get(o.optionId) ?? 0) === 0);
    if (tableAllIdMiss) {
      for (const o of optList) {
        o.votes = (voteMap.get(o.name) ?? 0) + o.jsonVotes;
      }
    }

    const totalVotes = optList.reduce((s, o) => s + (o.votes ?? 0), 0);
    const winning = optList.length ? optList.reduce((a, b) => (a.votes >= b.votes ? a : b)) : { name: "", votes: 0, optionId: "", jsonVotes: 0 };
    const winningPct = totalVotes > 0 ? ((winning.votes / totalVotes) * 100).toFixed(1) : "0";
    const second = optList.length >= 2 ? optList.filter((o) => o !== winning).reduce((a, b) => (a.votes >= b.votes ? a : b)) : { votes: 0 };
    const voteGapPct = totalVotes > 0 ? (((winning.votes - second.votes) / totalVotes) * 100).toFixed(1) : "0";
    const durationMinutes = (topicRow.duration_days || 7) * 24 * 60;

    // 5. Build AI input（確保含 topic_title, options 含 votes, winning_percentage 等供 user prompt 使用）
    const aiInput = {
      topic_title: topicRow.title,
      options: optList.map((o) => ({ id: o.optionId, name: o.name, votes: o.votes })),
      options_votes: optList.map((o) => ({ id: o.optionId, name: o.name, votes: o.votes })),
      total_votes: totalVotes,
      total_tokens_spent: 0,
      duration_minutes: durationMinutes,
      winning_option: winning.name,
      winning_percentage: winningPct,
      vote_gap_percentage: voteGapPct,
    };

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OpenAI API Key not configured");

    // 性格隨機化：四種人格，本次生成三語共用同一種
    const characterProfiles = ["Elitist", "ConspiracyTheorist", "ChaosCatalyst", "Existentialist"] as const;
    const selectedCharacter = characterProfiles[Math.floor(Math.random() * characterProfiles.length)];
    console.log("Selected character for this closing:", selectedCharacter);

    // 各語系「附加性格指令」範本（動態附加在 Base Prompt 末尾，要求 AI 採用選中的性格）
    const characterAppendByLang: Record<"zh" | "en" | "ja", string> = {
      zh: `\n\n【本次性格】請以「${selectedCharacter}」的視角與口吻撰寫本則結語，保持混亂結語的格式與結尾固定句。`,
      en: `\n\n[Character for this response] Write this closing in the voice and perspective of the ${selectedCharacter}. Keep the required format and closing phrase.`,
      ja: `\n\n【今回の人格】「${selectedCharacter}」の視点と口調でこの結語を書いてください。形式と決まり文句は維持すること。`,
    };

    // Base Prompt 必須從 system_config 讀取，不寫死字串，以維持後台即時修改功能
    type PromptByLang = { zh: string; en: string; ja: string };
    const resolvePrompts = (v: unknown): PromptByLang => {
      const missingLangFallback = "Generate a short closing statement for the voting topic in the requested language.";
      if (typeof v === "string") return { zh: v, en: v, ja: v };
      if (typeof v === "object" && v !== null && ("zh" in v || "en" in v || "ja" in v)) {
        const o = v as Record<string, unknown>;
        const by = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : missingLangFallback);
        return { zh: by("zh") || missingLangFallback, en: by("en") || missingLangFallback, ja: by("ja") || missingLangFallback };
      }
      return { zh: missingLangFallback, en: missingLangFallback, ja: missingLangFallback };
    };

    let promptsByLang: PromptByLang | null = null;
    try {
      const { data: promptConfig } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "ai_closing_prompt")
        .single();

      if (!promptConfig?.value) {
        console.error("ai_closing_prompt not set in system_config");
        return new Response(
          JSON.stringify({ error: "ai_closing_prompt not configured in system_config. Please set it in the admin backend." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      promptsByLang = resolvePrompts(promptConfig.value);
      console.log("Using AI prompt from system_config (ai_closing_prompt)");
    } catch (e) {
      console.error("Failed to fetch ai_closing_prompt from system_config:", e);
      return new Response(
        JSON.stringify({ error: "Failed to load ai_closing_prompt from system_config. Ensure the key exists and try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!promptsByLang) {
      return new Response(
        JSON.stringify({ error: "ai_closing_prompt not available" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 先把 system_config 的 {{var}} 模板替換成實際值，避免 AI 只看到佔位符
    const templateVars: Record<string, string> = {
      topic_title: String(aiInput.topic_title ?? ""),
      topic_description: topicDescription,
      winning_option: String(aiInput.winning_option ?? ""),
      winning_percentage: String(aiInput.winning_percentage ?? "0"),
      vote_gap_percentage: String(aiInput.vote_gap_percentage ?? "0"),
      total_votes: String(aiInput.total_votes ?? 0),
      duration_minutes: String(aiInput.duration_minutes ?? 0),
    };

    // 在 Base Prompt 末尾動態附加「本次性格」指令，三語共用同一 selectedCharacter
    const systemPromptZh = renderPromptTemplate(promptsByLang.zh, templateVars) + characterAppendByLang.zh;
    const systemPromptEn = renderPromptTemplate(promptsByLang.en, templateVars) + characterAppendByLang.en;
    const systemPromptJa = renderPromptTemplate(promptsByLang.ja, templateVars) + characterAppendByLang.ja;

    // User prompt：含 topic_title, options_votes, winning_percentage 等欄位
    const userPromptBase = `根據以下投票結果生成混亂結語：\n${JSON.stringify(aiInput, null, 2)}\n\n特別處理：若 total_votes 為 0，生成「群眾沉默」版本；若為 1，生成「孤獨決議」版本。`;

    const langInstructions: { lang: "zh" | "en" | "ja"; instruction: string; fallback: string; systemPrompt: string }[] = [
      { lang: "zh", instruction: "請用繁體中文輸出，不可使用英文或日文。", fallback: FALLBACK_ZH, systemPrompt: systemPromptZh },
      { lang: "en", instruction: "Output in English only.", fallback: FALLBACK_EN, systemPrompt: systemPromptEn },
      { lang: "ja", instruction: "日本語のみで出力してください。", fallback: FALLBACK_JA, systemPrompt: systemPromptJa },
    ];

    const generateOne = async (instruction: string, fallback: string, systemPrompt: string): Promise<string> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openAiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `${userPromptBase}\n\n${instruction}` },
              ],
              temperature: 0.7,
            }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          const text = data.choices?.[0]?.message?.content?.trim();
          if (!text) throw new Error("Empty AI response");
          return text;
        } catch (_e) {
          if (attempt === 1) return fallback;
        }
      }
      return fallback;
    };

    const [content_zh, content_en, content_ja] = await Promise.all(
      langInstructions.map(({ instruction, fallback, systemPrompt }) => generateOne(instruction, fallback, systemPrompt))
    );
    const content = content_zh || content_en || content_ja || FALLBACK_ZH;

    // 6. Insert (handle unique conflict - another request might have inserted)
    const { data: inserted, error: insertErr } = await supabase
      .from("topic_ai_summary")
      .insert({ topic_id, content, content_zh, content_en, content_ja })
      .select("id, content, content_zh, content_en, content_ja, created_at")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        const { data: existing3 } = await supabase
          .from("topic_ai_summary")
          .select("id, content, content_zh, content_en, content_ja, created_at")
          .eq("topic_id", topic_id)
          .single();
        if (existing3) {
          await supabase.from("topics").update({ ai_summary_generated: true }).eq("id", topic_id);
          return new Response(JSON.stringify({ success: true, data: existing3 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      throw insertErr;
    }

    await supabase.from("topics").update({ ai_summary_generated: true }).eq("id", topic_id);

    return new Response(JSON.stringify({ success: true, data: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-ai-closing error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
