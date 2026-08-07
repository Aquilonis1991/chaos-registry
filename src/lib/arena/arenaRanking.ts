import type { ArenaMessage } from "./types";

export const RECYCLED_VARIANT_COUNT = 20;

export const net = (m: Pick<ArenaMessage, "upvote_count" | "downvote_count">) =>
  (Number(m.upvote_count) || 0) - (Number(m.downvote_count) || 0);

export const isShielded = (m: Pick<ArenaMessage, "shield_until">, nowMs: number) =>
  Boolean(m.shield_until && new Date(m.shield_until).getTime() > nowMs);

/** 畫面顯示用剩餘分鐘：依 updated_at 推算自然衰減；鎖定中與後端相同不扣時間 */
export const displayTtlMinutes = (
  m: Pick<ArenaMessage, "ttl_minutes" | "shield_until" | "updated_at" | "created_at">,
  decayRate: number,
  nowMs: number
) => {
  const base = Math.max(0, m.ttl_minutes);
  if (isShielded(m, nowMs)) return base;
  const anchor = m.updated_at || m.created_at;
  const t0 = new Date(anchor).getTime();
  if (Number.isNaN(t0)) return base;
  const elapsedMin = (nowMs - t0) / 60000;
  return Math.max(0, Math.floor(base - decayRate * elapsedMin));
};

/** 顯示灰色回收卡（後端已回收或前端推算 TTL 已歸零） */
export const isRecycledView = (
  m: Pick<ArenaMessage, "recycled_at" | "shield_until" | "ttl_minutes" | "updated_at" | "created_at">,
  decayRate: number,
  nowMs: number
) => {
  if (m.recycled_at) return true;
  return !isShielded(m, nowMs) && displayTtlMinutes(m, decayRate, nowMs) <= 0;
};

export const getStableRecycledVariant = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % RECYCLED_VARIANT_COUNT) + 1;
};

export type ArenaRankingConfig = {
  coreThreshold: number;
  eliteThreshold: number;
  decayRate: number;
};

export type ArenaBoardView = {
  core: ArenaMessage | undefined;
  elite: ArenaMessage[];
  nonEliteSortedByTime: ArenaMessage[];
};

/** 排行邏輯：龍頭（core）／精英（elite）／其餘依時間排序（回收卡沉底） */
export const computeArenaBoard = (
  messages: ArenaMessage[],
  config: ArenaRankingConfig,
  nowMs: number
): ArenaBoardView => {
  const activeMessages = messages.filter((m) => !isRecycledView(m, config.decayRate, nowMs));

  const core = activeMessages
    .filter((m) => net(m) >= config.coreThreshold)
    .sort((a, b) => net(b) - net(a))[0];

  const elite = activeMessages
    .filter((m) => m.id !== core?.id && net(m) >= config.eliteThreshold)
    .sort((a, b) => net(b) - net(a))
    .slice(0, 3);

  const eliteIdSet = new Set(elite.map((m) => m.id));
  const nonEliteSortedByTime = messages
    .filter((m) => m.id !== core?.id && !eliteIdSet.has(m.id))
    .sort((a, b) => {
      const aRecycled = isRecycledView(a, config.decayRate, nowMs);
      const bRecycled = isRecycledView(b, config.decayRate, nowMs);
      if (aRecycled !== bRecycled) return aRecycled ? 1 : -1;
      const aTime = new Date(a.updated_at || a.created_at).getTime();
      const bTime = new Date(b.updated_at || b.created_at).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return { core, elite, nonEliteSortedByTime };
};
