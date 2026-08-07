export type MissionRecord = {
  completed: boolean;
  completed_at: string | null;
  last_completed_date?: string | null;
  progress?: number | null;
};

export type LoginStreakInfo = {
  current_streak: number;
  total_login_days: number;
  last_login_date: string | null;
  can_claim_today: boolean;
  streak_reward_available: boolean;
};

export type MissionProgressResult = { progress: number; completed: boolean };
