import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * 排程用：找出「已結束且尚未生成混亂結語」的主題，逐一呼叫 generate-ai-closing。
 * 由 Supabase Cron 或外部排程以 x-cron-secret 呼叫，主題結束後會自發生成結語，不依賴用戶點擊。
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    if (!expectedSecret || cronSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) throw new Error("Service role key not configured");

    const supabase = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();

    // 改為呼叫 RPC，由 DB 一次查出「已結束且尚無結語」的主題，避免 PostgREST .or() 造成 no results
    const { data: topicRows, error: listErr } = await supabase.rpc("get_ended_topics_without_closing");

    if (listErr) {
      console.error("[process-ended-topics-closing] RPC listErr", listErr);
      throw listErr;
    }
    const topicIds: string[] = (topicRows ?? []).map((r: { id: string }) => r.id);
    console.log(`[process-ended-topics-closing] end_at<=now 找到 ${topicIds.length} 筆未生成結語的主題`);

    // RPC 已排除已有 topic_ai_summary 的主題，直接使用
    const toProcess = topicIds;
    if (topicIds.length > 0) {
      console.log(`[process-ended-topics-closing] 待處理: ${toProcess.length} 筆`, toProcess.slice(0, 5).concat(toProcess.length > 5 ? ["..."] : []));
    }
    const results: { topic_id: string; success: boolean; error?: string }[] = [];

    for (const topicId of toProcess) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-ai-closing`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "x-cron-secret": cronSecret!,
          },
          body: JSON.stringify({ topic_id: topicId }),
        });
        const data = await res.json();
        if (res.ok && data?.success) {
          results.push({ topic_id: topicId, success: true });
        } else {
          const errMsg = data?.error ?? res.statusText;
          console.error(`[process-ended-topics-closing] topic ${topicId} 失敗:`, errMsg);
          results.push({ topic_id: topicId, success: false, error: errMsg });
        }
      } catch (e: any) {
        console.error(`[process-ended-topics-closing] topic ${topicId} 例外:`, e?.message);
        results.push({ topic_id: topicId, success: false, error: e?.message ?? "invoke failed" });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`[process-ended-topics-closing] 完成: processed=${toProcess.length} success=${successCount} failed=${toProcess.length - successCount}`);
    return new Response(
      JSON.stringify({
        processed: toProcess.length,
        success: successCount,
        failed: toProcess.length - successCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("process-ended-topics-closing error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
