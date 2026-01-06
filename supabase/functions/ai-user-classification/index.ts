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
        const userId = user.id;

        // 3. Weekly Limit Check (Cool-down)
        // Check if user has an assessment created in the last 7 days from the user_assessments table
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: recentAssessments, error: checkError } = await supabase
            .from("user_assessments")
            .select("created_at")
            .eq("user_id", userId)
            .gte("created_at", sevenDaysAgo.toISOString())
            .limit(1);

        if (checkError) throw checkError;

        if (recentAssessments && recentAssessments.length > 0) {
            return new Response(JSON.stringify({
                error: "Weekly limit reached",
                message: "您本週已完成鑑定，請下週再來！" // "You have completed the assessment this week, come back next week!"
            }), {
                status: 200, // Return 200 so client can read the error message
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 4. Fetch User Behavior Metrics (RPC)
        const { data: metrics, error: metricsError } = await supabase.rpc(
            "get_user_behavior_metrics",
            { p_user_id: userId }
        );

        if (metricsError) throw metricsError;

        // 5. Build Prompt
        const openAiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openAiKey) throw new Error("OpenAI API Key not configured");

        // Extract language from request or default to 'zh'
        const { language = 'zh' } = await req.json().catch(() => ({}));

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
      task = irrational_profile

      你正在執行「不理性鑑定」。
      這是一個娛樂性行為歸類，不是心理分析、不是診斷、不是測驗。

      規則：
      - 僅根據行為統計摘要產出結果。
      - 僅描述行為模式，不評價好壞。
      - 不使用「正常、不正常、健康、異常、應該」等價值詞。
      - 稱號需簡短、抽象、具系統標示感。
      - 結果必須明確標示為娛樂用途。
      - 使用指定語言輸出 (${language})。

      Input Data:
      - Total Votes: ${metrics.total_votes}
      - Created Topics: ${metrics.created_topics}
      - Activity Days: ${metrics.activity_days}

      輸出格式 JSON ONLY:
      {
        "title": "string",
        "summary": "string",
        "disclaimer": "本結果僅供娛樂用途，非心理分析。"
      }
    `;

        // 6. Call OpenAI (Stable v1/chat/completions)
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
                    { role: "user", content: "Analyze user based on formatted metrics. Output valid JSON." }
                ],
                temperature: 1.0,
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

        // 7. Save to Database (Map 'summary' to 'description')
        const { error: insertError } = await supabase
            .from("user_assessments")
            .insert({
                user_id: userId,
                title: result.title,
                description: result.summary,
                language: language
            });

        if (insertError) throw insertError;

        return new Response(JSON.stringify({
            success: true,
            data: {
                title: result.title,
                description: result.summary,
                disclaimer: result.disclaimer
            }
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
