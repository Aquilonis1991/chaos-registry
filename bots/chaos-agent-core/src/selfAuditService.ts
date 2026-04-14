import type { IAuditSource } from "./platform/types.js";
import {
  hashContent,
  loadCommentSnapshot,
  saveCommentSnapshot,
  type CommentSnapshotFile
} from "./commentSnapshot.js";
import { EmotionStateStore } from "./emotionState.js";
import type { InternalLogWriter } from "./internalLog.js";

/**
 * 定期透過 GET 公共 API 比對「自己的留言」是否仍存在。
 * 若清單 404、單筆 404、或 id/內容消失，僅寫入本機 internal_logs 與情緒狀態，不修改 ChaosRegistry 使用者資料。
 */
export class SelfAuditService {
  constructor(
    private readonly api: IAuditSource,
    private readonly agentId: string,
    private readonly snapshotPath: string,
    private readonly logs: InternalLogWriter,
    private readonly emotion: EmotionStateStore
  ) {}

  async runAuditCycle(): Promise<void> {
    const listResult = await this.api.getMyCommentsUnsafe();

    if (listResult.status === 404) {
      await this.logs.append({
        ts: Date.now(),
        agentId: this.agentId,
        type: "audit_list_404",
        detail: "GET 自己的留言清單回傳 404",
        apiPath: "/api/me/comments"
      });
      this.emotion.applyAuditListNotFound();
      return;
    }

    if (listResult.status !== 200) {
      await this.logs.append({
        ts: Date.now(),
        agentId: this.agentId,
        type: "comment_list_error",
        detail: `無法取得留言清單：HTTP ${listResult.status}`,
        apiPath: "/api/me/comments"
      });
      return;
    }

    const currentMap = this.normalizeComments(listResult.data);
    const prev = await loadCommentSnapshot(this.snapshotPath);

    for (const [id, prevEntry] of Object.entries(prev.byId)) {
      const cur = currentMap.get(id);
      if (!cur) {
        await this.logs.append({
          ts: Date.now(),
          agentId: this.agentId,
          type: "comment_vanished",
          detail: `留言 id 自列表消失：${id}（先前摘要：${prevEntry.preview}）`
        });
        this.emotion.applyCommentVanished(`id=${id}`);
        const one = await this.api.getCommentByIdUnsafe(id);
        if (one.status === 404) {
          await this.logs.append({
            ts: Date.now(),
            agentId: this.agentId,
            type: "single_comment_404",
            detail: `單筆 GET 仍為 404：${id}`,
            apiPath: `/api/comments/${id}`
          });
        }
        continue;
      }

      const h = hashContent(cur.content);
      if (h !== prevEntry.contentHash && cur.content.trim().length === 0) {
        await this.logs.append({
          ts: Date.now(),
          agentId: this.agentId,
          type: "comment_vanished",
          detail: `留言內容被清空：${id}`
        });
        this.emotion.applyCommentVanished("內容被清空");
      }
    }

    const next: CommentSnapshotFile = { updatedAt: new Date().toISOString(), byId: {} };
    for (const [id, c] of currentMap) {
      const content = c.content;
      next.byId[id] = {
        contentHash: hashContent(content),
        preview: content.slice(0, 80)
      };
    }
    await saveCommentSnapshot(this.snapshotPath, next);
  }

  private normalizeComments(data: unknown): Map<string, { id: string; content: string }> {
    const out = new Map<string, { id: string; content: string }>();
    const arr: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray((data as Record<string, unknown>)?.comments)
        ? ((data as { comments: unknown[] }).comments)
        : Array.isArray((data as Record<string, unknown>)?.data)
          ? ((data as { data: unknown[] }).data)
          : [];

    for (const item of arr) {
      const row = item as Record<string, unknown>;
      const id = String(row?.id ?? row?.commentId ?? "");
      if (!id) continue;
      const content = String(row?.content ?? row?.body ?? row?.text ?? "");
      out.set(id, { id, content });
    }
    return out;
  }
}

/**
 * 依固定間隔執行自我稽核（僅本機日誌與情緒狀態）。不呼叫主站寫入使用者資料。
 */
export function startPeriodicSelfAudit(
  audit: SelfAuditService,
  intervalMs: number,
  onError?: (error: unknown) => void
): () => void {
  const id = setInterval(() => {
    void audit.runAuditCycle().catch((e) => {
      onError?.(e);
    });
  }, intervalMs);
  return () => clearInterval(id);
}
