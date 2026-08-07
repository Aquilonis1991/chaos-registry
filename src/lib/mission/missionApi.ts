import { supabase } from "@/integrations/supabase/client";
import type { MissionRecord } from "./types";

export async function fetchUserMissions(userId: string): Promise<Record<string, MissionRecord>> {
  const { data, error } = await supabase
    .from("user_missions")
    .select("mission_id, completed, completed_at, last_completed_date, progress")
    .eq("user_id", userId);

  if (error) throw error;

  const missionsMap: Record<string, MissionRecord> = {};
  data?.forEach((mission) => {
    missionsMap[mission.mission_id] = {
      completed: mission.completed,
      completed_at: mission.completed_at,
      last_completed_date: (mission as any).last_completed_date ?? null,
      progress: (mission as any).progress ?? null,
    };
  });
  return missionsMap;
}

export async function fetchDailyVoteCount(
  userId: string,
  window: { startUtcIso: string; endUtcIso: string }
): Promise<number> {
  const [votesRes, freeVotesRes] = await Promise.all([
    supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", window.startUtcIso)
      .lte("created_at", window.endUtcIso),
    supabase
      .from("free_votes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("used_at", window.startUtcIso)
      .lte("used_at", window.endUtcIso),
  ]);
  if (votesRes.error) throw votesRes.error;
  if (freeVotesRes.error) throw freeVotesRes.error;
  return (votesRes.count ?? 0) + (freeVotesRes.count ?? 0);
}
