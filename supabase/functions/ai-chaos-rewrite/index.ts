
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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

    // 4. Call OpenAI for Rewrite
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OpenAI API Key not configured");

    const systemPrompt = `
      You are a chaotic creative assistant for a voting app.
      Your goal is to rewrite the user's input (Topic Title, Description, and Options) into a version that is:
      1. Slightly more absurd, dramatic, or humorous.
      2. BUT strictly keeps the original meaning and intent. Do not change the topic to something else.
      3. Use the SAME language as the user's input (if input is Chinese, output Chinese).
      4. Do NOT translate.
      
      Rules:
      - Title: Make it punchy, clickbaity, or overly dramatic. Max 50 chars.
      - Options: Rewrite them to be funny or extreme versions of the original. Keep the same number of options.
      - Description: Make it sound like a dramatic manifesto or a conspiracy theory, but keep the facts.
      
      Output JSON format ONLY:
      {
        "title": "New Title",
        "description": "New Description",
        "options": ["New Option 1", "New Option 2", ...]
      }
    `;

    const userContent = JSON.stringify({ title, description, options });

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Cost effective
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Rewrite this: ${userContent}` }
        ],
        temperature: 0.9, // High creativity
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await openAiResponse.json();
    if (aiData.error) throw new Error(aiData.error.message);

    const rewrittenContent = JSON.parse(aiData.choices[0].message.content);

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
