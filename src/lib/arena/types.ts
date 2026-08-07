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
  /** 最後一次 TTL／互動更新時間（自然衰減推算用） */
  updated_at: string;
  /** 後端軟回收時間；僅作者可查詢該列（RLS） */
  recycled_at?: string | null;
  recycled_body_snapshot?: string | null;
  recycled_approver_name_snapshot?: string | null;
  message_language?: string | null;
};

export type ArenaVoteType = "upvote" | "downvote";

export type ArenaBoardData = {
  messages: ArenaMessage[];
  authorNames: Record<string, string>;
  lastDownvoterNames: Record<string, string>;
};

export type ArenaPostErrorCode =
  | "one_message_per_topic"
  | "insufficient_vote_participation"
  | "banned_word"
  | "unknown";

export type ArenaPostError = {
  code: ArenaPostErrorCode;
  raw: string;
};

export type ArenaPostResult = { ok: true } | { ok: false; error: ArenaPostError };

export type ArenaVoteResult =
  | { ok: true }
  | { ok: false; reason: "not_logged_in" | "duplicate" | "rpc_error"; message?: string };
