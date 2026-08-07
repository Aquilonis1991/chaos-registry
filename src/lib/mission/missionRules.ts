import { getStreakCycleDay, getStreakCycleStartDateKey, getTaipeiDateKey, getTaipeiDateKeyFromIso } from "@/lib/taipeiCalendar";
import type { MissionProgressResult, MissionRecord } from "./types";

// 任務映射：前端任務 ID -> 數據庫任務 ID
export const MISSION_ID_MAP: Record<string, string> = {
  "1": "first_vote",      // 新手上路（需要創建）
  "2": "vote_lover",      // 投票愛好者
  "3": "topic_creator",   // 話題創造者
  "5": "nickname_editor", // 修改暱稱
  "6": "daily_vote_1",    // 每日投票 1 票
  "7": "daily_vote_5",    // 每日投票 5 票
  "8": "daily_vote_10",   // 每日投票 10 票
  "9": "streak_7_repeat",   // 連續簽到 7 天（可重複）
  "10": "streak_14_repeat", // 連續簽到 14 天（可重複）
  "11": "streak_30_repeat", // 連續簽到 30 天（可重複）
  "12": "daily_share_1", // 每日口耳相傳（分享）
};

export function toDbMissionId(frontendMissionId: string): string | undefined {
  return MISSION_ID_MAP[frontendMissionId];
}

export type MissionProgressContext = {
  statsLoading: boolean;
  isClaimed: boolean;
  markedProgress: number;
  totalVotes: number;
  uniqueTopicVotes: number;
  topicsCreated: number;
  nicknameUpdatedAt: string | null | undefined;
  dailyVoteCount: number;
  displayedStreak: number;
  dailyShareCopiedToday: boolean;
};

export function computeMissionProgress(
  missionId: string,
  target: number,
  ctx: MissionProgressContext
): MissionProgressResult {
  if (ctx.statsLoading) {
    return { progress: 0, completed: false };
  }

  // 如果已領取，任務視為已完成（即使統計數據為 0）
  if (ctx.isClaimed) {
    return { progress: 100, completed: true };
  }

  switch (missionId) {
    case "1": { // 新手上路
      const voteProgress = ctx.totalVotes > 0 ? 100 : 0;
      return { progress: voteProgress, completed: ctx.totalVotes > 0 };
    }
    case "2": { // 投票愛好者
      const uniqueTopics = ctx.uniqueTopicVotes || 0;
      const uniqueProgress = Math.min((uniqueTopics / target) * 100, 100);
      return { progress: uniqueProgress, completed: uniqueTopics >= target };
    }
    case "3": { // 話題創造者
      const topicProgress = ctx.topicsCreated > 0 ? 100 : 0;
      return { progress: topicProgress, completed: ctx.topicsCreated > 0 };
    }
    case "5": { // 修改暱稱
      const done = Boolean(ctx.nicknameUpdatedAt) || ctx.markedProgress >= 100;
      return { progress: done ? 100 : 0, completed: done };
    }
    case "6":
    case "7":
    case "8":
      return {
        progress: Math.min((ctx.dailyVoteCount / target) * 100, 100),
        completed: ctx.dailyVoteCount >= target,
      };
    case "9":
    case "10":
    case "11": {
      const cycleDay = getStreakCycleDay(ctx.displayedStreak);
      return {
        progress: Math.min((cycleDay / target) * 100, 100),
        completed: cycleDay >= target,
      };
    }
    case "12": {
      const copiedToday = ctx.dailyShareCopiedToday;
      return { progress: copiedToday ? 100 : 0, completed: copiedToday };
    }
    default:
      return { progress: 0, completed: false };
  }
}

export function isRewardClaimed(
  dbMissionId: string | undefined,
  record: MissionRecord | undefined,
  ctx: { displayedStreak: number; now?: Date }
): boolean {
  if (!dbMissionId) return false;
  if (!record?.completed) return false;

  const todayKey = getTaipeiDateKey();
  const lastDone = record.last_completed_date || null;
  const completedAtKey = getTaipeiDateKeyFromIso(record.completed_at);

  // 每日投票任務：只判斷今天是否已領
  if (dbMissionId === "daily_vote_1" || dbMissionId === "daily_vote_5" || dbMissionId === "daily_vote_10") {
    return (lastDone ?? completedAtKey) === todayKey;
  }

  if (dbMissionId === "daily_share_1") {
    return (lastDone ?? completedAtKey) === todayKey;
  }

  // 連續簽到可重複任務：同一輪 30 天循環內僅可領一次
  if (dbMissionId === "streak_7_repeat" || dbMissionId === "streak_14_repeat" || dbMissionId === "streak_30_repeat") {
    const streak = Math.max(0, ctx.displayedStreak || 0);
    if (streak <= 0) return false;
    const currentCycleStartStr = getStreakCycleStartDateKey(streak, 30, ctx.now);
    const streakDoneDate = lastDone ?? completedAtKey;
    return Boolean(streakDoneDate && streakDoneDate >= currentCycleStartStr);
  }

  if (!lastDone && !completedAtKey) return false;
  return true;
}

/** 連續簽到任務：依序完成才顯示下一個（7 -> 14 -> 30）。 */
export function getActiveStreakMissionId(claimed7: boolean, claimed14: boolean): "9" | "10" | "11" {
  if (claimed7 && claimed14) return "11";
  if (claimed7 && !claimed14) return "10";
  return "9";
}
