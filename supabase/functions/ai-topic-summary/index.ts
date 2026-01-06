
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
        const { topic_id, title, options = [], votes = {} } = await req.json();

        if (!topic_id) {
            throw new Error("topic_id is required");
        }

        // 1. Initialize Supabase Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 2. Auth Check (User must be logged in to trigger, though data is public)
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing Authorization header");

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
        if (authError || !user) throw new Error("Unauthorized");

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

        // 4. Construct Prompt
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
      task = official_summary

      你正在執行「官方結語」。
      這是一段投票結束後的系統結語，用於表示處理已完成。

      規則：
      - 僅根據投票統計數據描述結果狀態。
      - 不使用「民意、趨勢、社會、正確、錯誤」等詞。
      - 不預測、不評論、不給建議。
      - 語氣正式、冷靜、像系統公告。
      - 同一內容需以三種語言輸出，語意保持一致。

      Input Data:
      Topic: "${title}"
      Options: ${JSON.stringify(options)}
      Stats: ${JSON.stringify(votes)}

      輸出格式 JSON ONLY:
      {
        "grade": "I | II | III | IV | V",
        "zh": "string",
        "en": "string",
        "ja": "string"
      }
    `;

        // 5. Call OpenAI (GPT-5-Nano)
        // Combine prompts for "input"
        const finalInput = `${systemPrompt}\n\nTask Input:\nOfficial Summary for: ${title}\nDescription: ${description}\nOptions: ${JSON.stringify(options)}\nVotes: ${JSON.stringify(votes)}`;

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

        // Parse output_text
        let resultText = aiData.output_text;
        if (!resultText) {
            console.error("AI Response:", aiData);
            throw new Error("Invalid AI response structure");
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
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
