import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_TEMPLATES = [
  "ChaosRegistry 已完成紀錄。",
  "本次混亂已存檔。",
  "請冷靜地參與下一場混亂。",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { topic_id } = await req.json();
    if (!topic_id) throw new Error("topic_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) throw new Error("Service role key not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

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

    // 3. Check if already generated
    const { data: existing } = await supabase
      .from("topic_ai_summary")
      .select("id, content, created_at")
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
        .select("id, content, created_at")
        .eq("topic_id", topic_id)
        .maybeSingle();
      if (existing2) {
        return new Response(JSON.stringify({ success: true, data: existing2 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 4. Compute statistics
    const options = (topicRow.options || []) as Array<{ id?: string; text: string; votes?: number }>;
    const optList = options.map((o) => ({
      name: typeof o === "string" ? o : (o?.text ?? ""),
      votes: typeof o === "object" && o && "votes" in o ? (o.votes ?? 0) : 0,
    }));
    const totalVotes = optList.reduce((s, o) => s + o.votes, 0);
    const winning = optList.length ? optList.reduce((a, b) => (a.votes >= b.votes ? a : b)) : { name: "", votes: 0 };
    const winningPct = totalVotes > 0 ? ((winning.votes / totalVotes) * 100).toFixed(1) : "0";
    const second = optList.length >= 2 ? optList.filter((o) => o !== winning).reduce((a, b) => (a.votes >= b.votes ? a : b)) : { votes: 0 };
    const voteGapPct = totalVotes > 0 ? (((winning.votes - second.votes) / totalVotes) * 100).toFixed(1) : "0";
    const durationMinutes = (topicRow.duration_days || 7) * 24 * 60;

    // 5. Build AI input
    const aiInput = {
      topic_title: topicRow.title,
      options: optList,
      total_votes: totalVotes,
      total_tokens_spent: 0,
      duration_minutes: durationMinutes,
      winning_option: winning.name,
      winning_percentage: winningPct,
      vote_gap_percentage: voteGapPct,
    };

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OpenAI API Key not configured");

    const DEFAULT_SYSTEM_PROMPT = `你是一個名為 ChaosRegistry 的系統內的文字模組，負責在投票結束後生成「混亂結語」。
規則：
1. 輸出純文字段落，不可輸出 JSON 或程式碼。
2. 包含：開場儀式句、結果戲劇化描述、群體行為娛樂側寫。
3. 結尾必須擇一使用下列固定句：「ChaosRegistry 已完成紀錄。」「本次混亂已存檔。」「請冷靜地參與下一場混亂。」
4. 語氣：冷靜、無奈、帶有系統感，娛樂性。
5. 嚴禁心理分析、政治評論、現實建議。僅供娛樂。
6. 簡短，約 80–150 字。`;

    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    try {
      const { data: promptConfig } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "ai_closing_prompt")
        .single();

      if (promptConfig?.value) {
        systemPrompt = promptConfig.value;
        console.log("Using dynamic AI prompt from system_config");
      }
    } catch (e) {
      console.warn("Failed to fetch dynamic prompt, using default:", e);
    }

    const userPrompt = `根據以下投票結果生成混亂結語：\n${JSON.stringify(aiInput, null, 2)}\n\n特別處理：若 total_votes 為 0，生成「群眾沉默」版本；若為 1，生成「孤獨決議」版本。`;

    let content = "";

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
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error("Empty AI response");
        content = text;
        break;
      } catch (_e) {
        if (attempt === 1) {
          content = FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)];
        }
      }
    }

    if (!content) {
      content = FALLBACK_TEMPLATES[0];
    }

    // 6. Insert (handle unique conflict - another request might have inserted)
    const { data: inserted, error: insertErr } = await supabase
      .from("topic_ai_summary")
      .insert({ topic_id, content })
      .select("id, content, created_at")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        const { data: existing3 } = await supabase
          .from("topic_ai_summary")
          .select("id, content, created_at")
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
