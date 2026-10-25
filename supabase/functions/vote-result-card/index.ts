import { createClient } from "npm:@supabase/supabase-js@2";

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch] ?? ch);
}

// 公開結果圖卡。不含任何投票者身分。
Deno.serve(async (req) => {
  const topicId = new URL(req.url).searchParams.get("topic_id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(topicId)) {
    return new Response("bad topic", { status: 400 });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "",
  );
  const { data: topic } = await supabase.from("topics").select("title, options").eq("id", topicId).maybeSingle();
  const rows = ((topic?.options ?? []) as { id?: string; text?: string; votes?: number }[]).map((opt, index) => ({
    label: opt?.text || `選項 ${index + 1}`,
    votes: Number(opt?.votes) || 0,
  }));
  const max = Math.max(1, ...rows.map((row) => row.votes));
  const bars = rows.map((row, index) => {
    const width = Math.round((row.votes / max) * 520);
    const y = 120 + index * 64;
    const label = escapeXml(row.label);
    return `<text x="40" y="${y}" fill="#e8edf3" font-size="18" font-family="sans-serif">${label}</text>
      <rect x="40" y="${y + 8}" width="${width}" height="22" rx="6" fill="#06c755"/>
      <text x="570" y="${y + 25}" fill="#9fb0c3" font-size="14" font-family="sans-serif">${row.votes}</text>`;
  }).join("\n");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="${160 + rows.length * 64}" viewBox="0 0 640 ${160 + rows.length * 64}">
  <rect width="100%" height="100%" fill="#1a2332"/>
  <text x="40" y="56" fill="#ffffff" font-size="24" font-family="sans-serif">${escapeXml(topic?.title || "投票結果")}</text>
  ${bars}
</svg>`;
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
});
