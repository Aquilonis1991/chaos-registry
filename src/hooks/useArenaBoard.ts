import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerTime } from "@/contexts/ServerTimeContext";
import * as arenaApi from "@/lib/arena/arenaApi";
import {
  computeArenaBoard,
  displayTtlMinutes as displayTtlMinutesImpl,
  isRecycledView as isRecycledViewImpl,
  isShielded as isShieldedImpl,
} from "@/lib/arena/arenaRanking";
import type { ArenaMessage, ArenaPostResult, ArenaVoteResult, ArenaVoteType } from "@/lib/arena/types";

export type UseArenaBoardOptions = {
  topicId: string;
  userId: string | null;
  fallbackAuthorName: string;
  coreThreshold: number;
  eliteThreshold: number;
  decayRate: number;
};

export type UseArenaBoardResult = {
  messages: ArenaMessage[];
  loading: boolean;
  posting: boolean;
  voteIds: Set<string>;
  authorNames: Record<string, string>;
  lastDownvoterNames: Record<string, string>;
  core: ArenaMessage | undefined;
  elite: ArenaMessage[];
  nonEliteSortedByTime: ArenaMessage[];
  isRecycledView: (m: ArenaMessage) => boolean;
  isShielded: (m: ArenaMessage) => boolean;
  displayTtlMinutes: (m: ArenaMessage) => number;
  vote: (messageId: string, voteType: ArenaVoteType) => Promise<ArenaVoteResult>;
  post: (content: string, options: { buyShield: boolean; language: string }) => Promise<ArenaPostResult>;
  refetch: (opts?: { silent?: boolean }) => Promise<{ ok: boolean }>;
};

/**
 * Arena 模組的單一縫合點：介面為 messages/authorNames/board（core・elite・nonElite）
 * 加上 vote()、post() 兩個型別化的動作。抓取流程整合、衰減排名邏輯、RPC 錯誤分類
 * 全部收在這裡，呼叫端（畫面）只需渲染。
 */
export function useArenaBoard({
  topicId,
  userId,
  fallbackAuthorName,
  coreThreshold,
  eliteThreshold,
  decayRate,
}: UseArenaBoardOptions): UseArenaBoardResult {
  const { getNow, getNowMs, offsetMs } = useServerTime();

  const [messages, setMessages] = useState<ArenaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [voteIds, setVoteIds] = useState<Set<string>>(new Set());
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [lastDownvoterNames, setLastDownvoterNames] = useState<Record<string, string>>({});

  /** 定時觸發重繪，使「存在週期剩餘」隨時間遞減 */
  const [ttlTick, setTtlTick] = useState(0);
  useEffect(() => {
    if (messages.length === 0) return undefined;
    const id = window.setInterval(() => setTtlTick((n) => n + 1), 10000);
    return () => window.clearInterval(id);
  }, [messages.length, topicId]);

  const fetchBoard = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!topicId) {
        setLoading(false);
        return { ok: true as const };
      }
      if (!opts?.silent) setLoading(true);
      try {
        const board = await arenaApi.fetchArenaBoard(topicId, {
          silent: opts?.silent,
          fallbackAuthorName,
          decayRate,
          now: getNow(),
        });
        setMessages(board.messages);
        setAuthorNames(board.authorNames);
        setLastDownvoterNames(board.lastDownvoterNames);
        return { ok: true as const };
      } catch (e) {
        console.warn("[arena] fetchArenaBoard:", e);
        return { ok: false as const };
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [topicId, fallbackAuthorName, decayRate, getNow]
  );

  const fetchMyVotes = useCallback(async () => {
    if (!userId || messages.length === 0) return;
    const ids = await arenaApi.fetchMyVoteIds(
      userId,
      messages.map((m) => m.id)
    );
    setVoteIds(ids);
  }, [userId, messages]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    void fetchMyVotes();
  }, [fetchMyVotes]);

  const post = useCallback(
    async (content: string, options: { buyShield: boolean; language: string }): Promise<ArenaPostResult> => {
      setPosting(true);
      try {
        const result = await arenaApi.postArenaMessage({
          topicId,
          content,
          buyShield: options.buyShield,
          language: options.language,
        });
        if (result.ok) {
          await fetchBoard({ silent: true });
        }
        return result;
      } finally {
        setPosting(false);
      }
    },
    [topicId, fetchBoard]
  );

  const vote = useCallback(
    async (messageId: string, voteType: ArenaVoteType): Promise<ArenaVoteResult> => {
      if (!userId) {
        return { ok: false, reason: "not_logged_in" };
      }
      const mid = String(messageId);
      if (voteIds.has(mid)) {
        return { ok: false, reason: "duplicate" };
      }
      const result = await arenaApi.castArenaVote(mid, voteType);
      if (result.ok) {
        setVoteIds((s) => new Set([...s, mid]));
        await fetchBoard({ silent: true });
      }
      return result;
    },
    [userId, voteIds, fetchBoard]
  );

  const nowMs = getNowMs();
  const board = useMemo(
    () => computeArenaBoard(messages, { coreThreshold, eliteThreshold, decayRate }, nowMs),
    // ttlTick／offsetMs 觸發重新計算（衰減會隨時間改變分類），本身不是實際依賴值
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, coreThreshold, eliteThreshold, decayRate, ttlTick, offsetMs]
  );

  const isRecycledView = useCallback((m: ArenaMessage) => isRecycledViewImpl(m, decayRate, getNowMs()), [
    decayRate,
    getNowMs,
  ]);
  const isShielded = useCallback((m: ArenaMessage) => isShieldedImpl(m, getNowMs()), [getNowMs]);
  const displayTtlMinutes = useCallback(
    (m: ArenaMessage) => displayTtlMinutesImpl(m, decayRate, getNowMs()),
    [decayRate, getNowMs]
  );

  return {
    messages,
    loading,
    posting,
    voteIds,
    authorNames,
    lastDownvoterNames,
    core: board.core,
    elite: board.elite,
    nonEliteSortedByTime: board.nonEliteSortedByTime,
    isRecycledView,
    isShielded,
    displayTtlMinutes,
    vote,
    post,
    refetch: fetchBoard,
  };
}
