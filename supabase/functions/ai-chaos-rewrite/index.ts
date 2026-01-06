import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, options = [], description = "" } = await req.json();

    if (!title) {
      throw new Error("Title is required");
    }

    // 1. Initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Auth Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) throw new Error("Unauthorized");

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

      // Deduct tokens
      const { error: deductError } = await supabase.rpc("deduct_tokens", {
        token_amount: cost,
        user_id: user.id
      });

      if (deductError) {
        // Rollback logic could go here (decrement count), but for simplicity we just error out.
        // In a production system, we might want more robust transaction handling.
        throw new Error("Insufficient tokens or deduction failed");
      }

      // Log transaction
      await supabase.from("token_transactions").insert({
        user_id: user.id,
        amount: -cost,
        transaction_type: "ai_rewrite",
        description: `Unstable Rewrite (Daily #${usageCount})`
      });
    }

    // 4. Call OpenAI for Rewrite (GPT-5-Nano)
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OpenAI API Key not configured");

    const systemPrompt = `
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
      - 必須保留原始語意輪廓，但允許誇張、偏移、失真。
      - 不得加入與原內容無關的新主題。
      - 語氣可荒謬，但需中性、不具攻擊性。
      - 使用指定語言輸出 (若輸入為繁中則輸出繁中)。

      輸出格式 JSON ONLY:
      {
        "rewritten_title": "string",
        "options": ["string", "string", "string"]
      }
    `;

    const userContent = JSON.stringify({ title, description, options });
    const finalInput = `${systemPrompt}\n\nTask Input:\nRewrite to Chaos JSON: ${userContent}`;

    // Use refined gpt-5-nano API endpoint
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        input: finalInput,
        store: true
      }),
    });

    const aiData = await openAiResponse.json();
    if (aiData.error) throw new Error(aiData.error.message);

    // Parse output_text from standard response wrapper
    let resultText = aiData.output_text;
    if (!resultText) {
      // Fallback for debugging if structure differs
      console.error("AI Response:", aiData);
      throw new Error("Invalid AI response structure");
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
