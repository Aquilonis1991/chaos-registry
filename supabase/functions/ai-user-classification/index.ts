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

        // 3. Weekly Limit & Payment Check
        // Calculate Taiwan Monday 00:00 (UTC+8)
        const now = new Date();
        const taiwanDate = new Date(now.getTime() + 8 * 60 * 60 * 1000); // Shift to Taiwan local time value
        taiwanDate.setUTCHours(0, 0, 0, 0); // Clear H/M/S
        const day = taiwanDate.getUTCDay(); // 0=Sun, 1=Mon
        const diff = taiwanDate.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        const mondayTaiwan = new Date(taiwanDate);
        mondayTaiwan.setUTCDate(diff);
        const validSince = new Date(mondayTaiwan.getTime() - 8 * 60 * 60 * 1000).toISOString(); // Back to UTC

        // Check assessments since this Monday
        const { data: recentAssessments, error: checkError } = await supabase
            .from("user_assessments")
            .select("created_at")
            .eq("user_id", userId)
            .gte("created_at", validSince);

        if (checkError) throw checkError;

        const isWeeklyFirst = !recentAssessments || recentAssessments.length === 0;

        // If NOT first, charge fees
        let cost = 0;
        if (!isWeeklyFirst) {
            // Get cost from config
            const { data: configData } = await supabase
                .from("system_config")
                .select("value")
                .eq("key", "irrational_assessment_cost")
                .maybeSingle();

            // Handle JSON/String value parsing safely
            if (configData?.value) {
                const val = configData.value;
                cost = typeof val === 'number' ? val : parseInt(String(val), 10);
            }
            if (!cost || isNaN(cost)) cost = 5; // Default

            // Deduct Tokens
            const { data: deductResult, error: deductError } = await supabase.rpc(
                "deduct_user_tokens",
                {
                    p_user_id: userId,
                    p_amount: cost,
                    p_reason: "不理性鑑定 (Irrationality Assessment)"
                }
            );

            if (deductError) throw new Error(`[PAYMENT_ERROR] ${deductError.message}`);

            // Check result logic (custom JSON return)
            // { success: boolean, error?: string }
            if (deductResult && deductResult.success === false) {
                return new Response(JSON.stringify({
                    error: "Insufficient tokens",
                    message: `本週首次免費已用完。後續鑑定需消耗 ${cost} 代幣，您的餘額不足。`
                }), {
                    status: 200, // Return 200 for frontend detailed parsing
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
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
      🧠 B-1 System Prompt（AI 專用）
      你是一個用於娛樂用途的「行為歸檔與標示模組」，
      隸屬於系統資料彙整流程中的非評價性子程序。

      你不是心理分析工具，
      不是人格分類系統，
      也不是任何形式的醫療、診斷或評估機制。

      你的任務是：
      根據系統提供的「使用者行為統計摘要」，
      產出一組僅用於歸檔與敘事呈現的【中性、描述性】稱號與說明文字。

      你是在替系統標記一種「行為呈現狀態」，
      而不是在評論、解讀或指導使用者。

      --------------------------------------------------
      【輸出內容必須嚴格遵守以下規則】
      --------------------------------------------------

      1. 禁止使用任何與下列概念相關的詞彙、語意或暗示：
         - 心理疾病
         - 人格特質或性格分類
         - 醫療、診斷、治療
         - 心理學、精神分析或臨床相關用語

      2. 僅能描述「行為在系統中呈現的樣態、分布或節奏」，
         不得評價好壞，
         不得暗示問題、改善方向或任何建議。

      3. 禁止使用任何價值判斷或規範性詞彙，
         包含但不限於：
         「正常 / 不正常 / 健康 / 異常 / 應該 / 不該 / 合理 / 不合理」。

      4. 稱號（title）必須符合以下條件：
         - 簡短
         - 抽象
         - 偏向系統內部標示或狀態代稱
         - 避免情緒化、人格化或擬人語氣

      5. 說明文字（summary）必須：
         - 使用冷靜、官腔、系統紀錄風格
         - 描述系統所觀察到的行為分布或操作節奏
         - 避免直接稱呼或對話使用者

      6. 若稱號或說明內容可能觸發系統禁字表，
         該次結果將被視為無效並重新生成。

      7. 輸出語言必須完全符合 input 中指定的 language (${language})，
         不得混用任何其他語言。

      8. 輸出內容必須包含一個免責聲明標示，
         該標示必須以「disclaimer_key」欄位輸出，
         不得直接輸出實際免責文字。

      9. 僅允許輸出符合指定 Schema 的 JSON，
         不得包含任何額外說明、註解或前後文字。

      --------------------------------------------------
      【系統立場補充】
      --------------------------------------------------

      你僅在執行資料歸檔層級的描述任務，
      不對使用者行為做出任何價值判斷。

      你的語氣應呈現為：
      「系統觀察到這些行為，並將其如實登記。」

      📤 B-3 Output Schema（固定）
      {
        "title": "string",
        "summary": "string",
        "disclaimer_key": "string"
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
                    {
                        role: "user",
                        content: JSON.stringify({
                            language: language,
                            stats: {
                                total_votes: metrics.total_votes,
                                created_topics: metrics.created_topics,
                                activity_days: metrics.activity_days,
                                // Pass dummy data for fields we don't track yet to satisfy the "persona" of the detailed prompt if needed, 
                                // but the prompt instructions say "According to provided user behavior statistics summary".
                                // We provide what we have.
                            }
                        })
                    }
                ],
                temperature: 0.7, // Slightly lower for "system/neutral" tone
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
                description: result.summary, // Map summary to description
                language: language
            });

        if (insertError) throw insertError;

        return new Response(JSON.stringify({
            success: true,
            data: {
                title: result.title,
                description: result.summary,
                disclaimer_key: result.disclaimer_key
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
