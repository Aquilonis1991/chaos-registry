import { supabase } from "@/integrations/supabase/client";
import type {
  ArenaBoardData,
  ArenaMessage,
  ArenaPostError,
  ArenaPostErrorCode,
  ArenaPostResult,
  ArenaVoteResult,
  ArenaVoteType,
} from "./types";

function parseArenaPostError(e: unknown): ArenaPostError {
  const raw =
    (e as { message?: string })?.message || (e as { details?: string })?.details || String(e);
  let code: ArenaPostErrorCode = "unknown";
  if (/One message per topic allowed/i.test(raw)) {
    code = "one_message_per_topic";
  } else if (/Insufficient vote participation/i.test(raw)) {
    code = "insufficient_vote_participation";
  } else if (/Content contains banned word/i.test(raw)) {
    code = "banned_word";
  }
  return { code, raw };
}

async function decayArenaTtl(minutes: number): Promise<void> {
  try {
    await (supabase as any).rpc("decay_arena_ttl", { p_minutes: minutes });
  } catch (e) {
    console.warn("[arena] decay_arena_ttl:", e);
  }
}

async function fetchArenaMessages(topicId: string): Promise<ArenaMessage[]> {
  const { data, error } = await (supabase as any)
    .from("topic_arena_messages")
    .select(
      "id, topic_id, user_id, content, ttl_minutes, shield_until, upvote_count, downvote_count, is_legacy, created_at, updated_at, recycled_at, recycled_body_snapshot, recycled_approver_name_snapshot, message_language"
    )
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ArenaMessage[]) || [];
}

async function fetchAuthorNames(userIds: string[], fallback: string): Promise<Record<string, string>> {
  const next: Record<string, string> = {};
  if (userIds.length === 0) return next;
  const { data: profs, error } = await supabase.from("profiles").select("id, nickname").in("id", userIds);
  if (error) console.warn("[arena] profiles batch:", error.message);
  profs?.forEach((p) => {
    const row = p as { id: string; nickname: string | null };
    next[row.id] = (row.nickname && String(row.nickname).trim()) || fallback;
  });
  userIds.forEach((uid) => {
    if (!next[uid]) next[uid] = fallback;
  });
  return next;
}

async function fetchLastDownvoterNames(
  messageIds: string[],
  fallback: string
): Promise<Record<string, string>> {
  if (messageIds.length === 0) return {};
  const { data: votes, error: votesErr } = await (supabase as any)
    .from("topic_arena_votes")
    .select("message_id, user_id, created_at")
    .in("message_id", messageIds)
    .eq("vote_type", "downvote")
    .order("created_at", { ascending: false });
  if (votesErr) {
    console.warn("[arena] latest downvoters:", votesErr.message);
    return {};
  }

  const latestDownvoterByMessage: Record<string, string> = {};
  for (const v of votes || []) {
    const messageId = String((v as { message_id: string }).message_id);
    if (!latestDownvoterByMessage[messageId]) {
      latestDownvoterByMessage[messageId] = String((v as { user_id: string }).user_id);
    }
  }

  const downvoterIds = [...new Set(Object.values(latestDownvoterByMessage))];
  if (downvoterIds.length === 0) return {};

  const { data: downvoterProfiles, error: downvoterProfilesErr } = await supabase
    .from("profiles")
    .select("id, nickname")
    .in("id", downvoterIds);
  if (downvoterProfilesErr) {
    console.warn("[arena] downvoter profiles:", downvoterProfilesErr.message);
    return {};
  }

  const downvoterNameById: Record<string, string> = {};
  downvoterProfiles?.forEach((p) => {
    const row = p as { id: string; nickname: string | null };
    downvoterNameById[row.id] = (row.nickname && row.nickname.trim()) || fallback;
  });

  const lastByMessageName: Record<string, string> = {};
  Object.entries(latestDownvoterByMessage).forEach(([messageId, downvoterId]) => {
    lastByMessageName[messageId] = downvoterNameById[downvoterId] || fallback;
  });
  return lastByMessageName;
}

/** 將已歸零／已回收的留言，補上不可變快照（回收卡文案 + 最終核定員），避免之後衰減參數異動導致內容跟著變動 */
async function finalizeRecycledSnapshots(
  messages: ArenaMessage[],
  decayRate: number,
  now: Date
): Promise<ArenaMessage[]> {
  const snapshotTargetIds = messages
    .filter((m) => {
      const snapshotReady =
        Boolean(m.recycled_body_snapshot && String(m.recycled_body_snapshot).trim()) &&
        Boolean(m.recycled_approver_name_snapshot && String(m.recycled_approver_name_snapshot).trim());
      if (snapshotReady) return false;
      if (m.recycled_at) return true;
      if (m.shield_until && new Date(m.shield_until) > now) return false;
      const base = Math.max(0, Number(m.ttl_minutes) || 0);
      const anchor = m.updated_at || m.created_at;
      const t0 = new Date(anchor).getTime();
      if (Number.isNaN(t0)) return false;
      const elapsedMin = (now.getTime() - t0) / 60000;
      const effective = Math.max(0, Math.floor(base - decayRate * elapsedMin));
      return effective <= 0;
    })
    .map((m) => m.id);

  if (snapshotTargetIds.length === 0) return messages;

  try {
    await (supabase as any).rpc("finalize_arena_recycled_snapshots", {
      p_message_ids: snapshotTargetIds,
    });
    const { data: refreshedRows } = await (supabase as any)
      .from("topic_arena_messages")
      .select("id, recycled_body_snapshot, recycled_approver_name_snapshot")
      .in("id", snapshotTargetIds);

    if (!refreshedRows || !Array.isArray(refreshedRows) || refreshedRows.length === 0) {
      return messages;
    }
    const refreshedMap = new Map<string, { body?: string | null; approver?: string | null }>();
    refreshedRows.forEach((r: any) => {
      refreshedMap.set(String(r.id), {
        body: r.recycled_body_snapshot ?? null,
        approver: r.recycled_approver_name_snapshot ?? null,
      });
    });
    return messages.map((m) => {
      const snap = refreshedMap.get(String(m.id));
      if (!snap) return m;
      return {
        ...m,
        recycled_body_snapshot: snap.body ?? m.recycled_body_snapshot ?? null,
        recycled_approver_name_snapshot: snap.approver ?? m.recycled_approver_name_snapshot ?? null,
      };
    });
  } catch (snapshotError) {
    console.warn("[arena] finalize snapshot:", snapshotError);
    return messages;
  }
}

/**
 * 單一縫合點：抓取一個主題的完整角鬥場看板資料。
 * 依序：同步後端衰減 → 抓留言 → 批次補暱稱 → 批次補最新斥責者 → 補回收快照。
 * 訊息本體抓取失敗時拋出例外（呼叫端決定要不要保留舊畫面）；其餘子步驟失敗只降級（console.warn），不中斷看板顯示。
 */
export async function fetchArenaBoard(
  topicId: string,
  opts: { silent?: boolean; fallbackAuthorName: string; decayRate: number; now: Date }
): Promise<ArenaBoardData> {
  await decayArenaTtl(opts.silent ? 10 : 30);

  const rows = await fetchArenaMessages(topicId);
  if (rows.length === 0) {
    return { messages: [], authorNames: {}, lastDownvoterNames: {} };
  }

  const uids = [...new Set(rows.map((r) => r.user_id))];
  const authorNames = await fetchAuthorNames(uids, opts.fallbackAuthorName);

  const messageIds = rows.map((r) => r.id);
  const lastDownvoterNames = await fetchLastDownvoterNames(messageIds, opts.fallbackAuthorName);

  const messages = await finalizeRecycledSnapshots(rows, opts.decayRate, opts.now);

  return { messages, authorNames, lastDownvoterNames };
}

export async function fetchMyVoteIds(userId: string, messageIds: string[]): Promise<Set<string>> {
  if (!userId || messageIds.length === 0) return new Set();
  const { data } = await (supabase as any)
    .from("topic_arena_votes")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", messageIds);
  return new Set((data || []).map((r: { message_id: string }) => String(r.message_id)));
}

export async function postArenaMessage(params: {
  topicId: string;
  content: string;
  buyShield: boolean;
  language: string;
}): Promise<ArenaPostResult> {
  const { error } = await (supabase as any).rpc("post_arena_message", {
    p_topic_id: params.topicId,
    p_content: params.content,
    p_buy_shield: params.buyShield,
    p_language: params.language,
  });
  if (error) return { ok: false, error: parseArenaPostError(error) };
  return { ok: true };
}

export async function castArenaVote(messageId: string, voteType: ArenaVoteType): Promise<ArenaVoteResult> {
  const { error } = await (supabase as any).rpc("cast_arena_vote", {
    p_message_id: messageId,
    p_vote_type: voteType,
  });
  if (error) {
    return {
      ok: false,
      reason: "rpc_error",
      message: (error as { message?: string })?.message,
    };
  }
  return { ok: true };
}
