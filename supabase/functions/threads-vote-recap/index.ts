import { createClient } from "npm:@supabase/supabase-js@2";
import { postToThreads } from "../_shared/threadsPost.ts";

// 每天由排程呼叫：主題已結束、而且有 Threads 貼文 id 的，回一則結果到原貼文底下。
Deno.serve(async (req) => {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);
  const site = "https://www.chaosregistry.com";

  const { data: rows, error } = await supabase
    .from("topic_threads_posts")
    .select("topic_id, threads_media_id, topics!inner(title, status, end_at)")
    .is("replied_at", null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results: { topic_id: string; ok: boolean; error?: string }[] = [];
  for (const row of rows ?? []) {
    const topic = (row as { topics?: { title?: string; status?: string; end_at?: string } }).topics;
    const ended = topic?.status === "ended" || (topic?.end_at && new Date(topic.end_at).getTime() <= Date.now());
    if (!ended) continue;

    const { data: breakdown } = await supabase.rpc("get_topic_vote_breakdown", { p_topic_id: row.topic_id });
    const lines = (breakdown ?? []).map((item: { option_id: string; anon_votes: number; member_votes: number }) => {
      const total = Number(item.anon_votes) + Number(item.member_votes);
      return `${item.option_id}：匿名 ${item.anon_votes}、會員加碼 ${item.member_votes}（合計 ${total}）`;
    });
    const cardUrl = `${supabaseUrl}/functions/v1/vote-result-card?topic_id=${row.topic_id}`;
    const text = [
      `「${topic?.title ?? "這題"}」投票結果`,
      ...lines,
      `結果圖：${cardUrl}`,
      `${site}/vote/${row.topic_id}?src=threads`,
    ].join("\n").slice(0, 500);

    const posted = await postToThreads({ content: text, testMode: false, replyToId: row.threads_media_id });
    if (posted.success) {
      await supabase.from("topic_threads_posts").update({ replied_at: new Date().toISOString() }).eq("topic_id", row.topic_id);
    }
    results.push({ topic_id: row.topic_id, ok: posted.success, error: posted.error });
  }

  return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
});
