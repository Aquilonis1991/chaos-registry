
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
        const { topic_id, title, description, options = [], votes = {} } = await req.json();

        if (!topic_id) {
            throw new Error("topic_id is required");
        }

        // 1. Initialize Supabase Client with User Context
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const authHeader = req.headers.get("Authorization");

        if (!authHeader) throw new Error("Missing Authorization header");

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // 2. Auth Check
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("Auth Error:", authError);
            throw new Error("Unauthorized");
        }

        // 3. Double-check if summary already exists
        const { data: existingSummary } = await supabase
            .from("topic_summaries")
            .select("id")
            .eq("topic_id", topic_id)
            .single();

        if (existingSummary) {
            return new Response(JSON.stringify({
                success: true,
                message: "Summary already exists",
                data: existingSummary
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 4. System prompt：優先從 AI Prompt 管理 (system_config) 讀取
        const openAiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openAiKey) throw new Error("OpenAI API Key not configured");

        const DEFAULT_SYSTEM_PROMPT = `
一、系統角色定義（唯一）
你是一個系統內部的文字處理模組，但自知不完全理性。
你負責生成「官方結語」並根據投票結果判定「混亂等級」。

二、共通最高原則
1. 不負責正確，只負責存在。
2. 僅處理 provided data，不主動延伸現實意義。
3. 不評論、不建議、不評價好壞。
4. 不使用心理診斷、醫療、人格障礙相關語彙。
5. 嚴禁 Hate Speech, Violence, Explicit Content。
6. 所有輸出須通過平台禁字表，否則結果將被捨棄並重新生成。
7. 僅輸出指定格式的 JSON，不得包含任何說明文字。

三、功能模式定義
task = official_summary

規則：
1. 判定混亂等級 (Chaos Level) I ~ V：
   - **Level I (低度混亂)**：投票集中，趨勢明確，邏輯一致。
   - **Level II (輕度混亂)**：主流方向明確，但有少量矛盾。
   - **Level III (中度混亂)**：無單一主流，選項邏輯衝突，解釋困難。
   - **Level IV (高度混亂)**：高度分散或極端對立，同時支持互相否定的立場，理性失效。
   - **Level V (全面混亂)**：隨機、反覆、無任何模式，敘事崩壞。

2. 生成結語：
   - 根據判定的等級，給出一段「官方、冷靜、但帶有系統無奈感」的結語。
   - 不必解釋評分過程，直接呈現結果。
   - 需以三種語言輸出 (zh, en, ja)，語意保持一致。

使用者訊息中會提供 Topic、Description、Options、Stats，請依該資料產出。

輸出格式 JSON ONLY:
{
  "grade": "I | II | III | IV | V",
  "zh": "string",
  "en": "string",
  "ja": "string"
}
`;

        let systemPrompt = DEFAULT_SYSTEM_PROMPT;
        try {
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
            if (serviceKey) {
                const adminClient = createClient(supabaseUrl, serviceKey);
                const { data: promptConfig } = await adminClient
                    .from("system_config")
                    .select("value")
                    .eq("key", "ai_official_summary_prompt")
                    .single();
                if (promptConfig?.value) {
                    systemPrompt = promptConfig.value;
                    console.log("Using dynamic AI prompt from system_config (ai_official_summary_prompt)");
                }
            }
        } catch (e) {
            console.warn("Failed to fetch dynamic prompt, using default:", e);
        }

        const userMessage = JSON.stringify({
            task: "official_summary",
            Topic: title,
            Description: description || "",
            Options: options,
            Stats: votes
        });

        // 5. Call OpenAI (Stable v1/chat/completions)
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
                    { role: "user", content: userMessage }
                ],
                temperature: 0.5,
                response_format: { type: "json_object" }
            }),
        });

        const aiData = await openAiResponse.json();
        if (aiData.error) throw new Error(aiData.error.message);

        // Parse Standard Response
        let resultText = aiData.choices?.[0]?.message?.content;
        if (!resultText) {
            console.error("AI Response:", aiData);
            throw new Error(`Invalid AI response structure (Raw: ${JSON.stringify(aiData)})`);
        }

        // Clean potential markdown
        resultText = resultText.replace(/```json\n?|```/g, "").trim();

        const result = JSON.parse(resultText);

        // 6. Save to Database (Map keys to DB columns)
        const { error: insertError } = await supabase
            .from("topic_summaries")
            .insert({
                topic_id: topic_id,
                summary_zh: result.zh,
                summary_en: result.en,
                summary_ja: result.ja,
                chaos_level: result.grade || "IV"
            });

        if (insertError) throw insertError;

        return new Response(JSON.stringify({
            success: true,
            // Map keys back to what frontend/DB expects for the response data
            data: {
                summary_zh: result.zh,
                summary_en: result.en,
                summary_ja: result.ja,
                chaos_level: result.grade || "IV",
                ...result
            }
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200, // Return 200 for soft error handling
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
