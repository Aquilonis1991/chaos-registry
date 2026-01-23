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

        // 5. Build Prompt
        const openAiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openAiKey) throw new Error("OpenAI API Key not configured");

        // Extract language from request or default to 'zh'
        const { language = 'zh' } = await req.json().catch(() => ({}));

        // Default Prompt (Fallback)
        const DEFAULT_SYSTEM_PROMPT = `
      🧠 B-1 System Prompt（AI 專用）
      你是一個用於娛樂用途的「不理性行為側寫生成器」，
      專門為投票平台生成有趣、惡搞風格的使用者行為側寫。

      【重要】你的核心任務是生成「有趣、惡搞、幽默」的內容，絕對不要生成系統性、官腔、技術性的標籤或描述。

      你的任務是：
      根據系統提供的「使用者行為統計摘要」（包含：投票數、建立主題數、最近建立的主題名稱、最近投票的選項內容），
      產出一組【有趣、惡搞、幽默】的稱號與行為側寫。

      【資料運用指南】
      - **最近建立的主題 (created_topics)**: 觀察使用者喜歡建立什麼類型的話題（政治？感情？無厘頭？）。
      - **最近投票的內容 (recent_votes)**: 觀察使用者的選擇傾向（激進？隨波逐流？總是選少數派？）。
      - **請利用這些具體內容來強化側寫的幽默感與準確度**，例如：「你似乎對『午餐吃什麼』有著異常的執著...」或「你的投票選擇總是像在走鋼索...」。

      你不是心理分析工具，
      不是人格分類系統，
      也不是任何形式的醫療、診斷或評估機制。
      你只是在用幽默、誇張的方式描述使用者在平台上的行為模式。

      --------------------------------------------------
      【輸出內容必須嚴格遵守以下規則】
      --------------------------------------------------

      1. 禁止使用任何與下列概念相關的詞彙、語意或暗示：
         - 心理疾病
         - 人格特質或性格分類
         - 醫療、診斷、治療
         - 心理學、精神分析或臨床相關用語

      2. 稱號（title）【極重要】必須符合以下條件：
         - 簡短（2-8 個字）
         - 【必須】是有趣、生動、帶有幽默感的人格化、擬人化稱號
         - 可以誇張、惡搞，但不得冒犯或歧視
         - 【絕對禁止】使用系統性、官腔、抽象、技術性的詞彙
         - 【絕對禁止】使用類似「行為記錄狀態」、「操作模式 A」、「用戶類型 B」、「高活躍度用戶」、「系統標記 001」、「行為模式 C」等系統標籤
         - 【必須使用】具體、生動、有趣的稱號，例如：
           * 「不理性投票狂」、「話題製造機」、「潛水觀察員」
           * 「投票機器人」、「創意發想家」、「默默觀察者」
           * 「投票成癮者」、「話題獵人」、「潛水大師」
           * 「投票狂人」、「創意達人」、「觀察家」
         - 稱號應該讓使用者看了會覺得有趣、有共鳴，而不是感到被系統標記
         - 如果生成的稱號聽起來像系統標籤，必須重新生成

      3. 側寫文字（summary）【極重要】必須：
         - 【必須】使用幽默、惡搞、誇張的語氣
         - 【必須】以第三人稱或第二人稱描述使用者的行為模式
         - 【必須】加入誇張的比喻、有趣的形容
         - 【必須】風格類似「這個人看起來像是...」、「你就像是一個...」的惡搞描述
         - 【絕對禁止】冷靜、官腔、系統紀錄風格
         - 【絕對禁止】使用「系統記錄顯示」、「用戶行為分析」、「操作模式」等系統性詞彙
         - 可以帶有調侃、開玩笑的語氣，但不得惡意攻擊
         - 如果生成的側寫聽起來像系統記錄，必須重新生成
         - 【長度限制】側寫文字必須簡潔，長度約為範例的一半（約 30-50 字），避免過於冗長

      4. 範例風格參考（請嚴格遵循）：
         
         稱號（title）範例：
         - ✅ 好的稱號：「不理性投票狂」、「話題製造機」、「潛水觀察員」、「投票機器人」、「創意發想家」、「投票成癮者」、「話題獵人」
         - ❌ 【禁止】不好的稱號：「行為記錄狀態」、「操作模式 A」、「用戶類型 B」、「高活躍度用戶」、「系統標記 001」、「行為模式 C」、「活躍度等級 3」
         
         側寫（summary）範例：
         - ✅ 好的側寫（簡潔版，約 30-50 字）：「你就像是在投票海中瘋狂衝浪的浪人，看到任何話題都想插一腳，但話題創造力卻像是被封印了一樣。」
         - ✅ 好的側寫（簡潔版，約 30-50 字）：「你就像是一個投票機器人，看到選項就按，但創建話題的按鈕似乎被你遺忘了。」
         - ❌ 【禁止】不好的側寫：「系統記錄顯示該用戶投票次數較多，但創建話題次數較少。」、「用戶行為分析：高投票頻率，低創建頻率。」、「操作模式：積極參與投票，較少發起話題。」

      5. 若稱號或側寫內容可能觸發系統禁字表，
         該次結果將被視為無效並重新生成。

      6. 輸出語言必須完全符合 input 中指定的 language (${language})，
         不得混用任何其他語言。

      7. 輸出內容必須包含一個免責聲明標示，
         該標示必須以「disclaimer_key」欄位輸出，
         不得直接輸出實際免責文字。

      8. 僅允許輸出符合指定 Schema 的 JSON，
         不得包含任何額外說明、註解或前後文字。

      --------------------------------------------------
      【風格指引 - 請嚴格遵循】
      --------------------------------------------------

      你的語氣【必須】：
      - 幽默、有趣、帶點惡搞
      - 可以用誇張的比喻和形容
      - 可以調侃，但保持友善
      - 避免真正的冒犯或歧視
      - 讓使用者看了會笑，而不是感到被冒犯

      【最後提醒】
      - 這是一個娛樂功能，目的是讓使用者覺得有趣，而不是進行真正的行為分析
      - 如果你生成的內容聽起來像系統記錄或技術標籤，請重新生成
      - 稱號必須是有趣、人格化的，側寫必須是惡搞、幽默的
      - 絕對不要生成任何系統性、官腔、技術性的內容

      📤 B-3 Output Schema（固定）
      {
        "title": "string",
        "summary": "string",
        "disclaimer_key": "string"
      }
    `;

        let systemPrompt = DEFAULT_SYSTEM_PROMPT;
        try {
            const { data: promptConfig } = await supabase
                .from("system_config")
                .select("value")
                .eq("key", "ai_chaos_verification_prompt")
                .single();

            if (promptConfig?.value) {
                systemPrompt = promptConfig.value;
                console.log("Using dynamic AI prompt from system_config");
            }
        } catch (e) {
            console.warn("Failed to fetch dynamic prompt, using default:", e);
        }

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
                                recent_created_topics: metrics.recent_created_topics || [],
                                recent_votes: metrics.recent_votes || []
                            }
                        })
                    }
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
