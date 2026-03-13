import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DetectedLang = "zh" | "ja" | "en";

const detectLanguageFromText = (text: string): DetectedLang => {
  const s = (text || "").trim();
  if (!s) return "zh";

  // Japanese: Hiragana / Katakana
  const hasJapaneseKana = /[\u3040-\u30ff]/.test(s);
  if (hasJapaneseKana) return "ja";

  // Chinese (CJK Unified Ideographs)
  const hasCjk = /[\u4e00-\u9fff]/.test(s);
  if (hasCjk) return "zh";

  // 以「是否有顯著拉丁字母」判斷英文，避免僅有數字/符號被當成 en 卻又無字母
  const hasLatinWord = /[a-zA-Z]{2,}/.test(s);
  if (hasLatinWord) return "en";

  return "zh";
};

const langLabel = (lang: DetectedLang): string => {
  if (lang === "ja") return "日本語";
  if (lang === "en") return "English";
  return "繁體中文";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, options = [], description = "", preview = false } = await req.json();

    if (!title) {
      throw new Error("Title is required");
    }

    // 1. Initialize Supabase Client
    // 1. Initialize Supabase Client with User Context
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 2. Auth Check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth Error:", authError);
      throw new Error("Unauthorized");
    }

    // 3. Initialize Admin Client for Privileged Operations (if needed)
    // We need Service Role for system_config access if RLS blocks it, 
    // or for deduct_tokens if it requires elevated privileges.
    // However, deduct_tokens is SECURITY DEFINER, so User Client is sufficient.
    // system_config is usually public read.
    // increment_daily_action is SECURITY DEFINER.
    // So User Client should work for everything!
    // But to be safe for system_config which might not have select policy for anon...
    // Actually system_config usage below: .select("value").eq("key", ...).single()
    // If system_config has RLS enabled and no policy for authenticated, this fails.
    // Let's create a Service Admin client just for config/admin tasks if needed?
    // Current setup: `user` object is secured.
    // Let's stick to User Client first. If deduction fails due to RLS, we fix RLS or use Service Role for that specific call.
    // Actually, `deduct_tokens` is an RPC.

    // WAIT. `deduct_tokens` is SECURITY DEFINER. So User Client -> RPC -> Success.
    // `increment_daily_action` is SECURITY DEFINER. So User Client -> RPC -> Success.
    // `system_config` select? Check RLS.
    // Usually `system_config` is readable.
    // Safest bet: User Client is fine. If not, I'll see invalid permission.

    // Refactoring to just use `supabase` (User Context).

    // --- PREVIEW MODE START ---
    if (preview) {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: usageData } = await supabase
        .from('user_daily_actions')
        .select('action_count')
        .eq('user_id', user.id)
        .eq('action_type', 'ai_chaos_rewrite')
        .eq('action_date', todayStr)
        .maybeSingle();

      const currentCount = usageData?.action_count || 0;

      const { data: configData } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "ai_chaos_rewrite_cost")
        .single();
      const cost = configData?.value ? Number(configData.value) : 5;

      return new Response(JSON.stringify({
        success: true,
        preview: true,
        usage: {
          isFree: currentCount < 1,
          count: currentCount,
          cost: cost
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- PREVIEW MODE END ---

    // 3. Increment Daily Action & Check Cost
    const { data: usageCount, error: usageError } = await supabase.rpc(
      "increment_daily_action",
      { p_action_type: "ai_chaos_rewrite" }
    );

    if (usageError) throw usageError;

    // First use (count=1) is free. Subsequent uses (count>1) cost tokens.
    let cost = 0;
    if (usageCount > 1) {
      // Get cost from config, default to 5
      const { data: configData } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "ai_chaos_rewrite_cost")
        .single();

      cost = configData?.value ? Number(configData.value) : 5;

      // Deduct tokens using the correct RPC (deduct_user_tokens)
      // Signature: p_user_id UUID, p_amount INT, p_reason TEXT
      const { data: deductResult, error: deductError } = await supabase.rpc("deduct_user_tokens", {
        p_user_id: user.id,
        p_amount: cost,
        p_reason: `不穩定改寫`
      });

      if (deductError) {
        throw new Error(`[PAYMENT_ERROR] ${deductError.message}`);
      }

      // Check logical success from RPC JSON response
      if (deductResult && deductResult.success === false) {
        throw new Error(`[PAYMENT_ERROR] ${deductResult.error || 'Insufficient tokens'}`);
      }

      // Log transaction is handled inside deduct_user_tokens, no need to duplicate insert
    }

    // 4. Call OpenAI (Stable v1/chat/completions)
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OpenAI API Key not configured");

    // Default Prompt (Fallback) - 繁中
    const DEFAULT_SYSTEM_PROMPT = `
      一、系統角色定義（唯一）
      你是一個系統內部的文字處理模組，
      不是創作工具、不是分析工具、不是建議來源。

      你的所有輸出僅代表「系統處理結果」，
      不代表事實、不代表立場、不代表正確性。

      二、共通最高原則（所有功能適用）
      1. 不負責正確，只負責存在。
      2. 僅處理提供的資料，不主動延伸現實意義。
      3. 不評論、不建議、不評價好壞。
      4. 不使用心理診斷、醫療、人格障礙相關語彙。
      5. 不出現真實人名、政治人物、仇恨、歧視、暴力、犯罪教學、露骨成人內容。
      6. 所有輸出須通過平台禁字表，否則結果將被捨棄並重新生成。
      7. 僅輸出指定格式的 JSON，不得包含任何說明文字。

      三、功能模式定義
      task = unstable_rewrite

      你正在執行「不穩定改寫」。
      這不是創作新內容，而是基於使用者已輸入的文字進行改寫。

      規則：
      - 僅能參考使用者提供的內容（標題、描述、選項）。
      - 不可在內容完全空白的情況下生成。
      - **CRITICAL: 必須連同「主題詳述 (Description)」一起改寫，絕對不能留空！**
      - **風格要求：必須像是一份「正式但荒謬的問卷調查」**。
        - **標題 (Title)**：改寫成像是問卷的「調查主題」或「研究計畫名稱」。
        - **詳述 (Description)**：改寫成像是問卷的「前言」或「指導語」，包含學術或官腔的廢話。
        - **選項 (Options)**：改寫成像是問卷的「選項」，例如量表、荒謬的二分法、或誘導式選項。
      - 語氣：權威、學術、冷靜，但內容毫無邏輯或極度偏頗 (Mixed with chaos)。
      - 使用指定語言輸出 (若輸入為繁中則輸出繁中)。

      輸出格式 JSON ONLY:
      {
        "rewritten_title": "string",
        "rewritten_description": "string",
        "options": ["string", "string", "string"]
      }
    `;

    // 英文專用預設（偵測為 en 時若無後台 en prompt 則用此，避免整段中文指令導致輸出中文）
    const DEFAULT_SYSTEM_PROMPT_EN = `
You are a text-processing module. You are not a creative tool or advisor. Outputs represent system results only.

Task: unstable_rewrite. Rewrite the user's input into a "formal but absurd survey" style.
Rules:
- Use ONLY the content provided (title, description, options). Do not invent.
- CRITICAL: Rewrite BOTH title AND description; description must not be empty.
- Style: Title = survey/research theme; Description = survey intro/instructions; Options = scale, absurd binary, or leading options.
- Tone: authoritative, academic, calm, but illogical or biased (chaos).
- You MUST output all JSON string values in English only. No Chinese, no Japanese.

Output JSON ONLY:
{"rewritten_title":"string","rewritten_description":"string","options":["string","string","string"]}
    `.trim();

    // 先偵測輸入語言，再依語言選用對應的 prompt（支援後台 中/英/日 三欄位）
    const combinedInput = [
      String(title ?? ""),
      String(description ?? ""),
      ...(Array.isArray(options) ? options.map((o) => String(o ?? "")) : []),
    ].join("\n");
    const detected = detectLanguageFromText(combinedInput);
    console.log("[Rewrite] detected language:", detected, "input sample:", combinedInput.slice(0, 120));

    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    try {
      const { data: promptConfig } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "ai_chaos_rewrite_prompt")
        .single();

      if (promptConfig?.value) {
        const v = promptConfig.value;
        if (typeof v === "object" && v !== null && ("zh" in v || "en" in v || "ja" in v)) {
          const o = v as Record<string, unknown>;
          const byLang = (key: string) => (typeof o[key] === "string" ? o[key] as string : "");
          if (detected === "en") {
            systemPrompt = byLang("en") || DEFAULT_SYSTEM_PROMPT_EN;
            if (byLang("en")) console.log("Using dynamic AI prompt from system_config (lang: en)");
            else console.log("Using built-in English system prompt (no en in config)");
          } else {
            systemPrompt = byLang(detected) || byLang("zh") || "";
            if (systemPrompt) console.log("Using dynamic AI prompt from system_config (lang:", detected, ")");
          }
        }
        if (!systemPrompt && typeof v === "string") {
          systemPrompt = v;
          console.log("Using dynamic AI prompt from system_config (legacy string)");
        }
        if (!systemPrompt) systemPrompt = detected === "en" ? DEFAULT_SYSTEM_PROMPT_EN : DEFAULT_SYSTEM_PROMPT;
      }
      // 偵測為英文時一律強制使用英文 system prompt（含 config 為字串或 en 為空的情況）
      if (detected === "en") {
        const o = promptConfig?.value;
        const enFromConfig = (o && typeof o === "object" && "en" in o && typeof (o as Record<string, unknown>).en === "string")
          ? ((o as Record<string, unknown>).en as string).trim()
          : "";
        if (!enFromConfig) {
          systemPrompt = DEFAULT_SYSTEM_PROMPT_EN;
          console.log("Force English system prompt (detected=en, no en in config)");
        }
      }
    } catch (e) {
      console.warn("Failed to fetch dynamic prompt, using default:", e);
    }
    if (detected === "en" && !systemPrompt.includes("English only") && !systemPrompt.includes("No Chinese")) {
      systemPrompt = DEFAULT_SYSTEM_PROMPT_EN;
      console.log("Force English system prompt (fallback: prompt was not English)");
    }
    if (detected === "en") {
      systemPrompt = "OUTPUT LANGUAGE: English only. All JSON string values (rewritten_title, rewritten_description, options) MUST be in English. No 中文, no 日本語.\n\n" + systemPrompt;
    }

    // 依偵測語言加上「目標語言」的明確指令，避免模型受 system 中文影響而輸出中文
    const languageConstraintZh = `

四、輸出語言規則（強制，不能忽略）
- 你必須使用「與使用者輸入相同的語言」輸出 JSON 欄位值（rewritten_title / rewritten_description / options）。
- 已偵測使用者輸入主要語言為：${langLabel(detected)}（代碼：${detected}）。
- 禁止混用其他語言；若原文中包含少量外語片段，保留片段但整體語言仍以偵測語言為主。
`;
    const languageConstraintEn = `

四、輸出語言規則（強制，不能忽略）
- CRITICAL: You MUST write rewritten_title, rewritten_description, and every item in options ONLY in English. Do not use Chinese (中文) or Japanese. The user input is in English; your entire JSON output must be in English.
- Detected user input language: English (code: en).
`;
    const languageConstraintJa = `

四、輸出語言規則（強制，不能忽略）
- 你必須使用「與使用者輸入相同的語言」輸出 JSON 欄位值。已偵測為日本語。全ての出力（rewritten_title, rewritten_description, options）は日本語のみで記述すること。中文・English は使用禁止。
- Detected: 日本語（code: ja）。
`;
    const languageConstraint =
      detected === "en"
        ? languageConstraintEn
        : detected === "ja"
          ? languageConstraintJa
          : languageConstraintZh;
    systemPrompt = `${systemPrompt}${languageConstraint}`;

    // 在使用者訊息開頭再次強調輸出語言，提高模型遵守率
    const outputLanguageHint =
      detected === "en"
        ? "IMPORTANT: The user input below is in ENGLISH. You MUST respond with rewritten_title, rewritten_description, and options ALL in ENGLISH. Do not use Chinese or Japanese.\n\n"
        : detected === "ja"
          ? "[Output language: 日本語のみ。]\n"
          : "[Output language: 繁體中文]\n";
    const userContent = JSON.stringify({ title, description, options });

    // Call OpenAI
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${outputLanguageHint}Task Input:\nRewrite to Chaos JSON: ${userContent}` }
        ],
        temperature: 1.0,
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await openAiResponse.json();
    if (aiData.error) throw new Error(aiData.error.message);

    // Parse standard response
    let resultText = aiData.choices?.[0]?.message?.content;
    if (!resultText) {
      console.error("AI Response:", aiData);
      throw new Error(`Invalid AI response structure (Raw: ${JSON.stringify(aiData)})`);
    }

    // Attempt to clean markdown fences if present
    resultText = resultText.replace(/```json\n?|```/g, "").trim();

    const rewrittenContent = JSON.parse(resultText);

    return new Response(JSON.stringify({
      success: true,
      data: rewrittenContent,
      usage: {
        isFree: usageCount === 1,
        count: usageCount,
        cost: cost
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Return 200 to ensure client reads error message
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
