import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ArenaMessage = {
  id: string;
  topic_id: string;
  user_id: string;
  content: string;
  ttl_minutes: number;
  shield_until: string | null;
  upvote_count: number;
  downvote_count: number;
  is_legacy: boolean;
  created_at: string;
};

export function ArenaSection({
  topicId,
  topicEndAt,
  userId,
  isTopicEnded,
}: {
  topicId: string;
  topicEndAt: string;
  userId: string | null;
  isTopicEnded: boolean;
}) {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { getConfig } = useSystemConfigCache();
  const [messages, setMessages] = useState<ArenaMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [buyShield, setBuyShield] = useState(false);
  const [posting, setPosting] = useState(false);
  const [voteIds, setVoteIds] = useState<Set<string>>(new Set());

  const x = getConfig("arena_throne_min_threshold_x", 100) as number;
  const y = getConfig("arena_elite_min_threshold_y", 50) as number;
  const maxLen = getConfig("arena_comment_max_length", 100) as number;
  const shieldPrice = getConfig("arena_shield_price", 100) as number;
  const upBonus = getConfig("arena_upvote_time_bonus", 10) as number;
  const downPenalty = getConfig("arena_downvote_time_penalty", 12) as number;

  const fetchMessages = useCallback(async () => {
    if (!topicId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("topic_arena_messages")
      .select("*")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(getText("arena.toast.loadFailed", "載入失敗"));
      return;
    }
    setMessages((data as ArenaMessage[]) || []);
  }, [topicId, getText]);

  const fetchMyVotes = useCallback(async () => {
    if (!userId || messages.length === 0) return;
    const ids = messages.map((m) => m.id);
    const { data } = await supabase
      .from("topic_arena_votes")
      .select("message_id")
      .eq("user_id", userId)
      .in("message_id", ids);
    setVoteIds(new Set((data || []).map((r) => r.message_id)));
  }, [userId, messages]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    fetchMyVotes();
  }, [fetchMyVotes]);

  const handlePost = async () => {
    if (!userId) return;
    const t = (inputText || "").trim();
    if (!t) return;
    if (t.length > maxLen) {
      toast.error(getText("arena.toast.maxChars", "最多 {{max}} 字").replace("{{max}}", String(maxLen)));
      return;
    }
    setPosting(true);
    try {
      const { data, error } = await supabase.rpc("post_arena_message", {
        p_topic_id: topicId,
        p_content: t,
        p_buy_shield: buyShield,
      });
      if (error) throw error;
      setInputOpen(false);
      setInputText("");
      setBuyShield(false);
      toast.success(getText("arena.toast.postSuccess", "已發表"));
      fetchMessages();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || getText("arena.toast.postFailed", "發表失敗");
      toast.error(msg);
    } finally {
      setPosting(false);
    }
  };

  const handleVote = async (messageId: string, voteType: "upvote" | "downvote") => {
    if (!userId) return;
    if (voteIds.has(messageId)) return;
    try {
      const { error } = await supabase.rpc("cast_arena_vote", {
        p_message_id: messageId,
        p_vote_type: voteType,
      });
      if (error) throw error;
      setVoteIds((s) => new Set([...s, messageId]));
      fetchMessages();
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || getText("arena.toast.voteFailed", "投票失敗"));
    }
  };

  const net = (m: ArenaMessage) => m.upvote_count - m.downvote_count;
  const isShielded = (m: ArenaMessage) => m.shield_until && new Date(m.shield_until) > new Date();
  const core = messages.filter((m) => net(m) >= x).sort((a, b) => net(b) - net(a))[0];
  const elite = messages
    .filter((m) => m.id !== core?.id && net(m) >= y)
    .sort((a, b) => net(b) - net(a))
    .slice(0, 3);
  const mundane = messages.filter(
    (m) => m.id !== core?.id && !elite.some((e) => e.id === m.id)
  );

  if (!topicId) return null;

  return (
    <section className="mb-4 font-mono" aria-label="數據回收角鬥場">
      {messages.length === 0 && !loading ? (
        <div className="border border-[#333333] bg-[#050505] text-[#A0A0A0] p-6 text-center">
          <p className="text-sm">{getText("arena.empty", "尚未有人留言")}</p>
        </div>
      ) : (
        <>
      {core && (
        <div className="border-4 border-[#D4AF37] bg-black text-white p-6 mb-4">
          <p className="text-sm text-[#A0A0A0] mb-1">{getText("arena.coreLabel", "核心區")}</p>
          <p>{core.content}</p>
          <p className="text-xs mt-2">👍{core.upvote_count} / 👎{core.downvote_count}</p>
          <p className="text-xs text-[#A0A0A0]">{getText("arena.ttlRemaining", "存在週期剩餘: {{minutes}} 分鐘").replace("{{minutes}}", String(core.ttl_minutes))}</p>
          {isShielded(core) && <span className="text-[#D4AF37]">{getText("arena.shieldLocked", "[🔒數據鎖定中]")}</span>}
          {userId !== core.user_id && !voteIds.has(core.id) && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => handleVote(core.id, "upvote")}>
                {getText("arena.upvote", "贊同 (+{{bonus}})").replace("{{bonus}}", String(upBonus))}
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => handleVote(core.id, "downvote")}>
                {getText("arena.downvote", "斥責 (-{{penalty}})").replace("{{penalty}}", String(downPenalty))}
              </Button>
            </div>
          )}
        </div>
      )}

      {elite.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-[#E0E0E0] mb-2">{getText("arena.eliteLabel", "精英區")}</p>
          {elite.map((m) => (
            <div
              key={m.id}
              className="border-2 border-[#C0C0C0] bg-[#0D0D0D] text-[#E0E0E0] p-4"
            >
              <p>{m.content}</p>
              <p className="text-xs mt-1">👍{m.upvote_count} / 👎{m.downvote_count}</p>
              <p className="text-xs text-[#A0A0A0]">{getText("arena.ttlRemaining", "存在週期剩餘: {{minutes}} 分鐘").replace("{{minutes}}", String(m.ttl_minutes))}</p>
              {userId !== m.user_id && !voteIds.has(m.id) && !isTopicEnded && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => handleVote(m.id, "upvote")}
                  >
                    {getText("arena.upvote", "贊同 (+{{bonus}})").replace("{{bonus}}", String(upBonus))}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => handleVote(m.id, "downvote")}
                  >
                    {getText("arena.downvote", "斥責 (-{{penalty}})").replace("{{penalty}}", String(downPenalty))}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {mundane.map((m) => (
        <div
          key={m.id}
          className={cn(
            "p-3 mb-2 font-mono",
            userId === m.user_id
              ? "border-2 border-dashed border-[#666666] bg-[#050505] text-[#A0A0A0]"
              : "border border-[#333333] bg-[#050505] text-[#A0A0A0]"
          )}
        >
          {isShielded(m) && (
            <span className="text-[#D4AF37] text-xs">{getText("arena.shieldLocked", "[🔒數據鎖定中]")}</span>
          )}
          <p>{m.content}</p>
          <p className="text-xs mt-1">👍{m.upvote_count} / 👎{m.downvote_count}</p>
          <p className="text-xs">{getText("arena.ttlRemaining", "存在週期剩餘: {{minutes}} 分鐘").replace("{{minutes}}", String(m.ttl_minutes))}</p>
          {userId !== m.user_id && !voteIds.has(m.id) && !isTopicEnded && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => handleVote(m.id, "upvote")}>
                {getText("arena.upvote", "贊同 (+{{bonus}})").replace("{{bonus}}", String(upBonus))}
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => handleVote(m.id, "downvote")}>
                {getText("arena.downvote", "斥責 (-{{penalty}})").replace("{{penalty}}", String(downPenalty))}
              </Button>
            </div>
          )}
        </div>
      ))}

      {!isTopicEnded && userId && (
        <>
          <Button variant="outline" size="sm" className="mt-2 font-mono" onClick={() => setInputOpen(true)}>
            {getText("arena.postButton", "發表觀點")}
          </Button>
          <Dialog open={inputOpen} onOpenChange={setInputOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{getText("arena.dialogTitle", "發表觀點")}</DialogTitle>
              </DialogHeader>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={getText("arena.placeholderMaxChars", "最多 {{max}} 字").replace("{{max}}", String(maxLen))}
                maxLength={maxLen}
                className="font-mono"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={buyShield} onChange={(e) => setBuyShield(e.target.checked)} />
                {getText("arena.shieldOption", "購買數據鎖定保險 ({{price}} 代幣)").replace("{{price}}", String(shieldPrice))}
              </label>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInputOpen(false)}>{getText("arena.cancel", "取消")}</Button>
                <Button onClick={handlePost} disabled={posting || !inputText.trim()}>
                  {posting ? getText("arena.submitting", "發表中...") : getText("arena.submit", "發表")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
        </>
      )}
    </section>
  );
}
