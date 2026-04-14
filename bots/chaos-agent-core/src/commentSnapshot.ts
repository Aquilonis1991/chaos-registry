import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";

export type CommentSnapshotFile = {
  updatedAt: string;
  /** commentId -> 內容雜湊 */
  byId: Record<string, { contentHash: string; preview: string }>;
};

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function loadCommentSnapshot(path: string): Promise<CommentSnapshotFile> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as CommentSnapshotFile;
  } catch {
    return { updatedAt: new Date(0).toISOString(), byId: {} };
  }
}

export async function saveCommentSnapshot(path: string, snap: CommentSnapshotFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  snap.updatedAt = new Date().toISOString();
  await writeFile(path, JSON.stringify(snap, null, 2), "utf8");
}
