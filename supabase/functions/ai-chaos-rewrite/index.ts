import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
          { role: "user", content: `Task Input:\nRewrite to Chaos JSON: ${userContent}` }
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
