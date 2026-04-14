/** 與 SelfAuditService 相容的清單／單筆查詢結果 */
export type UnsafeHttpResult = { status: number; data?: unknown };

/** 對外行為來源：REST 假 API 或真 Supabase（與 votechaos 主站一致） */
export type ChaosPlatformKind = "supabase" | "rest";

export interface IAuditSource {
  getMyCommentsUnsafe(): Promise<UnsafeHttpResult>;
  getCommentByIdUnsafe(commentId: string): Promise<UnsafeHttpResult>;
}
