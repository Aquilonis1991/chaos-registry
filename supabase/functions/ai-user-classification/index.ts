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
                    p_reason: "不理性鑑定"
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
            "get_user_detailed_behavior",
            { p_user_id: userId }
        );

        if (metricsError) throw metricsError;

        // 確保有帶出「最近建立的主題名稱」與「最近投票（主題+選項）」供 AI 參考
        const recentTopics = metrics.recent_created_topics ?? [];
        const recentVotes = metrics.recent_votes ?? [];
        console.log("[ai-user-classification] metrics:", {
            total_votes: metrics.total_votes,
            created_topics: metrics.created_topics,
            recent_created_topics_count: Array.isArray(recentTopics) ? recentTopics.length : 0,
            recent_created_topics_sample: Array.isArray(recentTopics) ? recentTopics.slice(0, 3) : [],
            recent_votes_count: Array.isArray(recentVotes) ? recentVotes.length : 0,
            recent_votes_sample: Array.isArray(recentVotes) ? recentVotes.slice(0, 3) : [],
        });

        // 5. Build Prompt
        const openAiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openAiKey) throw new Error("OpenAI API Key not configured");

        // Extract language from request or default to 'zh'
        const { language = 'zh' } = await req.json().catch(() => ({}));

        // AI Prompt 必須從 system_config 讀取，不寫死字串，以維持後台即時修改功能
        const langKey = String(language).startsWith("zh") ? "zh" : String(language).startsWith("ja") ? "ja" : "en";
        const missingLangFallback = "Generate a short, humorous user behavior title and summary based on the stats. Output JSON only: {\"title\":\"string\",\"summary\":\"string\",\"disclaimer_key\":\"string\"}.";
        let systemPrompt: string;
        try {
            const { data: promptConfig } = await supabase
                .from("system_config")
                .select("value")
                .eq("key", "ai_chaos_verification_prompt")
                .single();

            if (!promptConfig?.value) {
                console.error("ai_chaos_verification_prompt not set in system_config");
                return new Response(
                    JSON.stringify({ error: "ai_chaos_verification_prompt not configured in system_config. Please set it in the admin backend." }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const v = promptConfig.value;
            if (typeof v === "string") {
                systemPrompt = v;
                console.log("Using AI prompt from system_config (ai_chaos_verification_prompt, legacy string)");
            } else if (typeof v === "object" && v !== null && ("zh" in v || "en" in v || "ja" in v)) {
                const o = v as Record<string, unknown>;
                const byLang = (key: string) => (typeof o[key] === "string" ? (o[key] as string).trim() : "");
                systemPrompt = byLang(langKey) || byLang("zh") || byLang("en") || byLang("ja") || missingLangFallback;
                if (systemPrompt === missingLangFallback) console.log("Using minimal fallback for missing lang in config");
                else console.log("Using AI prompt from system_config (lang:", langKey, ")");
            } else {
                systemPrompt = missingLangFallback;
                console.log("Using minimal fallback (invalid config shape)");
            }
            console.log("[ai-user-classification] systemPrompt length:", systemPrompt?.length ?? 0, "first 120 chars:", (systemPrompt ?? "").slice(0, 120));
        } catch (e) {
            console.error("Failed to fetch ai_chaos_verification_prompt from system_config:", e);
            return new Response(
                JSON.stringify({ error: "Failed to load ai_chaos_verification_prompt from system_config. Ensure the key exists and try again." }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 6. Call OpenAI：user 內容明確標示「以下為該使用者實際資料」，促使模型依 recent_created_topics / recent_votes 生成
        const userPayload = {
            language: language,
            instruction: "以下為該使用者的實際行為資料，請務必根據「最近建立的主題名稱」與「最近投票（主題＋選項）」內容生成稱號與側寫，不要忽略這些具體內容。",
            stats: {
                total_votes: metrics.total_votes,
                created_topics: metrics.created_topics,
                activity_days: metrics.activity_days,
                recent_created_topics: recentTopics,
                recent_votes: recentVotes
            }
        };
        const userContentStr = JSON.stringify(userPayload);

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
                    { role: "user", content: userContentStr }
                ],
                temperature: 0.9,
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

        // 8. Update Profile Designation (Sync to profile for Home Page display)
        const { error: profileUpdateError } = await supabase
            .from("profiles")
            .update({ designation: result.title })
            .eq("id", userId);

        if (profileUpdateError) {
            console.warn("Failed to update profile designation:", profileUpdateError);
            // Non-blocking error, we still return the assessment result
        }

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
