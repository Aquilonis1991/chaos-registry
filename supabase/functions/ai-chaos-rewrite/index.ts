import { createClient } from "npm:@supabase/supabase-js@2";
import { xaiChatCompletion } from "../_shared/xai.ts";

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

    // 4. Call Grok（xAI Chat Completions）

    // 先偵測輸入語言，再依語言選用對應的 prompt（支援後台 中/英/日 三欄位）
    const combinedInput = [
      String(title ?? ""),
      String(description ?? ""),
      ...(Array.isArray(options) ? options.map((o) => String(o ?? "")) : []),
    ].join("\n");
    const detected = detectLanguageFromText(combinedInput);
    console.log("[Rewrite] detected language:", detected, "input sample:", combinedInput.slice(0, 120));

    // AI Prompt 必須從 system_config 讀取，不寫死字串，以維持後台即時修改功能
    const missingLangFallback = "Rewrite the user's content into a formal but absurd survey style. Output valid JSON only: {\"rewritten_title\":\"string\",\"rewritten_description\":\"string\",\"options\":[\"string\"]}.";
    let systemPrompt: string;
    try {
      const { data: promptConfig } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "ai_chaos_rewrite_prompt")
        .single();

      if (!promptConfig?.value) {
        console.error("ai_chaos_rewrite_prompt not set in system_config");
        return new Response(
          JSON.stringify({ error: "ai_chaos_rewrite_prompt not configured in system_config. Please set it in the admin backend." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const v = promptConfig.value;
      if (typeof v === "string") {
        systemPrompt = v;
        console.log("Using AI prompt from system_config (ai_chaos_rewrite_prompt, legacy string)");
      } else if (typeof v === "object" && v !== null && ("zh" in v || "en" in v || "ja" in v)) {
        const o = v as Record<string, unknown>;
        const byLang = (key: string) => (typeof o[key] === "string" ? (o[key] as string).trim() : "");
        systemPrompt = byLang(detected) || byLang("zh") || byLang("en") || byLang("ja") || missingLangFallback;
        if (systemPrompt === missingLangFallback) console.log("Using minimal fallback for missing lang in config");
        else console.log("Using AI prompt from system_config (lang:", detected, ")");
      } else {
        systemPrompt = missingLangFallback;
        console.log("Using minimal fallback (invalid config shape)");
      }
    } catch (e) {
      console.error("Failed to fetch ai_chaos_rewrite_prompt from system_config:", e);
      return new Response(
        JSON.stringify({ error: "Failed to load ai_chaos_rewrite_prompt from system_config. Ensure the key exists and try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // 主題詳述長度控制：目標為原文約 1.5~2 倍，並受系統上限保護（避免 create-topic 驗證失敗）
    const rawDescription = String(description ?? "").trim();
    const inputDescLen = rawDescription.length;
    const { data: descMaxConfig } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "description_max_length")
      .single();
    const descMaxLength = descMaxConfig?.value ? Number(descMaxConfig.value) : 500;
    const safeDescMaxLength = Number.isFinite(descMaxLength) && descMaxLength > 0 ? descMaxLength : 500;

    const minTarget = inputDescLen > 0 ? Math.min(Math.ceil(inputDescLen * 1.5), safeDescMaxLength) : Math.min(120, safeDescMaxLength);
    const maxTarget = inputDescLen > 0 ? Math.min(Math.ceil(inputDescLen * 2.0), safeDescMaxLength) : Math.min(220, safeDescMaxLength);
    const normalizedMinTarget = Math.max(20, Math.min(minTarget, maxTarget));
    const normalizedMaxTarget = Math.max(normalizedMinTarget, maxTarget);

    const descriptionLengthHint = `
[Description length rule]
- rewritten_description target length: ${normalizedMinTarget}-${normalizedMaxTarget} characters.
- This range is mandatory unless the source content is too short to support it.
- Never exceed ${safeDescMaxLength} characters.`;
    const userContent = JSON.stringify({ title, description, options });

    const aiData = await xaiChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${outputLanguageHint}${descriptionLengthHint}\n\nTask Input:\nRewrite to Chaos JSON: ${userContent}` },
      ],
      temperature: 1.0,
      response_format: { type: "json_object" },
    });
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
