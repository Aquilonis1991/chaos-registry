import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  Loader2,
  Pencil,
  Trash2,
  Plus,
  Minus,
  ThumbsUp,
  ThumbsDown,
  Clock,
  RefreshCw,
  Calendar,
} from "lucide-react";

const CONTENT_MAX = 100;
const DEFAULT_STEP = 1;
const FETCH_BATCH_SIZE = 500;
const TOPIC_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ArenaRow = {
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
  updated_at: string;
  recycled_at: string | null;
};

type TopicMeta = { id: string; title: string; status: string | null; end_at: string | null };
type ProfileMeta = { id: string; nickname: string | null };
type TopicStateMeta = { title: string; status?: string | null; end_at?: string | null };

export default function ArenaMessagesManager() {
  const [rows, setRows] = useState<ArenaRow[]>([]);
  const [topics, setTopics] = useState<Record<string, TopicStateMeta>>({});
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [topicFilter, setTopicFilter] = useState("");
  const [dateRange, setDateRange] = useState("30"); // days, 'all' for all time
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ttlInput, setTtlInput] = useState<Record<string, string>>({});
  const [upvoteInput, setUpvoteInput] = useState<Record<string, string>>({});
  const [downvoteInput, setDownvoteInput] = useState<Record<string, string>>({});
  const [shieldInput, setShieldInput] = useState<Record<string, string>>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<ArenaRow | null>(null);
  const [editContent, setEditContent] = useState("");

  const calculateDateRange = useCallback(() => {
    if (dateRange === "all") return { start: null, end: null };
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(dateRange, 10));
    return { start: start.toISOString(), end: end.toISOString() };
  }, [dateRange]);

  const fetchAllArenaRows = useCallback(async (topicId: string) => {
    const all: ArenaRow[] = [];
    let from = 0;
    const { start, end } = calculateDateRange();

    while (true) {
      let q = supabase
        .from("topic_arena_messages")
        .select(
          "id, topic_id, user_id, content, ttl_minutes, shield_until, upvote_count, downvote_count, is_legacy, created_at, updated_at, recycled_at"
        )
        .order("created_at", { ascending: false })
        .range(from, from + FETCH_BATCH_SIZE - 1);

      if (topicId.length > 0 && TOPIC_UUID_RE.test(topicId)) {
        q = q.eq("topic_id", topicId);
      }
      if (start && end) {
        q = q.gte("created_at", start).lte("created_at", end);
      }

      const { data, error } = await q;
      if (error) throw error;

      const batch = (data || []) as ArenaRow[];
      all.push(...batch);

      if (batch.length < FETCH_BATCH_SIZE) break;
      from += FETCH_BATCH_SIZE;
    }

    return all;
  }, [calculateDateRange]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 進入頁面或手動重新載入時，先同步一次存在週期衰減/回收，盡量對齊前台剩餘時間狀態
      try {
        await (supabase as any).rpc("decay_arena_ttl", { p_minutes: 30 });
      } catch (decayError) {
        console.warn("[admin][arena] decay_arena_ttl failed:", decayError);
      }
      const topicIdTrim = topicFilter.trim();
      const list = await fetchAllArenaRows(topicIdTrim);
      setRows(list);

      const tids = [...new Set(list.map((r) => r.topic_id))];
      const uids = [...new Set(list.map((r) => r.user_id))];

      if (tids.length) {
        const { data: trows } = await supabase.from("topics").select("id, title, status, end_at").in("id", tids);
        const tm: Record<string, TopicStateMeta> = {};
        (trows as TopicMeta[] | null)?.forEach((topic) => {
          tm[topic.id] = {
            title: topic.title,
            status: topic.status ?? null,
            end_at: topic.end_at ?? null,
          };
        });
        setTopics(tm);
      } else setTopics({});

      if (uids.length) {
        const { data: prows } = await supabase.from("profiles").select("id, nickname").in("id", uids);
        const pm: Record<string, string> = {};
        (prows as ProfileMeta[] | null)?.forEach((p) => {
          pm[p.id] = (p.nickname && String(p.nickname).trim()) || p.id.slice(0, 8);
        });
        setAuthors(pm);
      } else setAuthors({});
    } catch (e: unknown) {
      console.error(e);
      toast.error("載入觀點留言失敗");
    } finally {
      setLoading(false);
    }
  }, [fetchAllArenaRows, topicFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const setBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (row: ArenaRow) => {
    if (!confirm("確定刪除此則觀點留言？（相關贊同／斥責紀錄一併刪除）")) return;
    setBusy(row.id, async () => {
      const { error } = await supabase.from("topic_arena_messages").delete().eq("id", row.id);
      if (error) throw error;
      toast.success("已刪除");
    }).catch(() => toast.error("刪除失敗"));
  };

  const openEdit = (row: ArenaRow) => {
    setEditRow(row);
    setEditContent(row.content);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    const t = editContent.trim();
    if (!t.length) {
      toast.error("內容不可為空");
      return;
    }
    if (t.length > CONTENT_MAX) {
      toast.error(`內容最多 ${CONTENT_MAX} 字`);
      return;
    }
    setBusyId(editRow.id);
    try {
      const { error } = await supabase
        .from("topic_arena_messages")
        .update({ content: t, updated_at: new Date().toISOString() })
        .eq("id", editRow.id);
      if (error) throw error;
      toast.success("已更新內文");
      setEditOpen(false);
      setEditRow(null);
      await load();
    } catch {
      toast.error("更新失敗");
    } finally {
      setBusyId(null);
    }
  };

  const adjustTtl = (row: ArenaRow, delta: number) => {
    setBusy(row.id, async () => {
      const next = Math.max(0, row.ttl_minutes + delta);
      const patch: Record<string, unknown> = {
        ttl_minutes: next,
        updated_at: new Date().toISOString(),
      };
      if (next > 0 && row.recycled_at) {
        patch.recycled_at = null;
      }
      const { error } = await supabase.from("topic_arena_messages").update(patch).eq("id", row.id);
      if (error) throw error;
      toast.success(
        delta >= 0 ? `已增加 ${Math.abs(delta)} 分鐘` : `已減少 ${Math.abs(delta)} 分鐘`
      );
    }).catch(() => toast.error("調整存在週期失敗"));
  };

  const adjustVote = (row: ArenaRow, field: "upvote_count" | "downvote_count", delta: number) => {
    setBusy(row.id, async () => {
      const cur = row[field];
      const next = Math.max(0, cur + delta);
      const { error } = await supabase
        .from("topic_arena_messages")
        .update({ [field]: next, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("已調整票數");
    }).catch(() => toast.error("調整票數失敗"));
  };

  const adjustShield = (row: ArenaRow, deltaMinutes: number) => {
    setBusy(row.id, async () => {
      const now = new Date();
      const current = row.shield_until ? new Date(row.shield_until) : null;

      if (deltaMinutes < 0 && (!current || Number.isNaN(current.getTime()) || current <= now)) {
        throw new Error("目前沒有可減少的鎖定時間");
      }

      const base = current && !Number.isNaN(current.getTime()) && current > now ? current : now;
      const next = new Date(base.getTime() + deltaMinutes * 60_000);

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        shield_until: next <= now ? null : next.toISOString(),
      };

      const { error } = await supabase.from("topic_arena_messages").update(patch).eq("id", row.id);
      if (error) throw error;

      if (next <= now) toast.success("鎖定時間已清除");
      else toast.success(deltaMinutes > 0 ? `已增加 ${deltaMinutes} 分鐘鎖定時間` : `已減少 ${Math.abs(deltaMinutes)} 分鐘鎖定時間`);
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "調整鎖定時間失敗";
      toast.error(msg);
    });
  };

  const parseStep = (raw: string | undefined) => {
    if (!raw || raw.trim() === "") return DEFAULT_STEP;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n <= 0) return DEFAULT_STEP;
    return n;
  };

  const isTopicEnded = (topicId: string) => {
    const t = topics[topicId];
    if (!t) return false;
    if (t.status === "ended") return true;
    if (!t.end_at) return false;
    return new Date(t.end_at) <= new Date();
  };

  const isLocked = (row: ArenaRow) => Boolean(row.shield_until && new Date(row.shield_until) > new Date());

  const getMessageStatus = (row: ArenaRow) => {
    if (row.recycled_at) return { label: "已回收", variant: "secondary" as const };
    if (isTopicEnded(row.topic_id)) return { label: "封存", variant: "default" as const };
    if (isLocked(row)) return { label: "鎖定中", variant: "outline" as const };
    return { label: "顯示中", variant: "outline" as const };
  };

  const formatLockTime = (row: ArenaRow) => {
    if (!row.shield_until) return "—";
    const end = new Date(row.shield_until);
    if (Number.isNaN(end.getTime())) return "—";
    const now = Date.now();
    const diffMs = end.getTime() - now;
    const endText = format(end, "MM/dd HH:mm", { locale: zhTW });
    if (diffMs <= 0) return `${endText}（已到期）`;
    const min = Math.max(1, Math.ceil(diffMs / 60000));
    const h = Math.floor(min / 60);
    const m = min % 60;
    const remain = h > 0 ? `${h}小時${m}分鐘` : `${m}分鐘`;
    return `${endText}（剩餘 ${remain}）`;
  };

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>觀點角鬥場留言</CardTitle>
          <CardDescription>
            管理使用者觀點：編輯內文、調整存在週期（分鐘）、調整贊同／斥責數、刪除。已回收留言仍可在此查看與處理。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-md">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">資料區間：</span>
            </div>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="選擇時間範圍" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">最近 7 天</SelectItem>
                <SelectItem value="30">最近 30 天</SelectItem>
                <SelectItem value="90">最近 90 天</SelectItem>
                <SelectItem value="365">最近 1 年</SelectItem>
                <SelectItem value="all">全部時間</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label htmlFor="topicFilter">依話題 ID 篩選（選填，完整 UUID）</Label>
              <Input
                id="topicFilter"
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                placeholder="留空顯示全部留言；或貼上 topic_id"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              重新載入
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            依資料區間篩選後顯示全部留言（分批載入）；時間、贊同、斥責可先輸入調整量，空白預設為 {DEFAULT_STEP}。
          </p>
        </CardContent>
      </Card>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">話題</TableHead>
              <TableHead className="min-w-[100px]">作者</TableHead>
              <TableHead className="min-w-[200px]">內容</TableHead>
              <TableHead>存在週期</TableHead>
              <TableHead>贊同</TableHead>
              <TableHead>斥責</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="min-w-[180px]">鎖定時間</TableHead>
              <TableHead className="min-w-[280px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  沒有資料
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const disabled = busyId === row.id;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="align-top text-sm">
                      <div className="font-medium line-clamp-2">{topics[row.topic_id]?.title || "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-1 break-all">
                        {row.topic_id}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm">{authors[row.user_id] || row.user_id.slice(0, 8)}</TableCell>
                    <TableCell className="align-top text-sm max-w-[280px]">
                      <span className="line-clamp-3">{row.content}</span>
                    </TableCell>
                    <TableCell className="align-top whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {row.ttl_minutes} 分
                      </div>
                    </TableCell>
                    <TableCell className="align-top">{row.upvote_count}</TableCell>
                    <TableCell className="align-top">{row.downvote_count}</TableCell>
                    <TableCell className="align-top">
                      {(() => {
                        const status = getMessageStatus(row);
                        return <Badge variant={status.variant}>{status.label}</Badge>;
                      })()}
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(row.created_at), "MM/dd HH:mm", { locale: zhTW })}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm">{formatLockTime(row)}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => openEdit(row)}
                            title="編輯文字"
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            編輯
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={disabled}
                            onClick={() => handleDelete(row)}
                            title="刪除"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            刪除
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="text-xs text-muted-foreground w-full">時間</span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={ttlInput[row.id] ?? ""}
                            onChange={(e) =>
                              setTtlInput((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                            placeholder="1"
                            className="h-8 w-20"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={disabled}
                            onClick={() => adjustTtl(row, parseStep(ttlInput[row.id]))}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            增加
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={disabled}
                            onClick={() => adjustTtl(row, -parseStep(ttlInput[row.id]))}
                          >
                            <Minus className="h-3 w-3 mr-1" />
                            減少
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="text-xs text-muted-foreground w-full">贊同</span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={upvoteInput[row.id] ?? ""}
                            onChange={(e) =>
                              setUpvoteInput((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                            placeholder="1"
                            className="h-8 w-20"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() =>
                              adjustVote(row, "upvote_count", parseStep(upvoteInput[row.id]))
                            }
                          >
                            <ThumbsUp className="h-3 w-3 mr-1" />+
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() =>
                              adjustVote(row, "upvote_count", -parseStep(upvoteInput[row.id]))
                            }
                          >
                            <ThumbsUp className="h-3 w-3 mr-1 rotate-180" />−
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="text-xs text-muted-foreground w-full">斥責</span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={downvoteInput[row.id] ?? ""}
                            onChange={(e) =>
                              setDownvoteInput((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                            placeholder="1"
                            className="h-8 w-20"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() =>
                              adjustVote(row, "downvote_count", parseStep(downvoteInput[row.id]))
                            }
                          >
                            <ThumbsDown className="h-3 w-3 mr-1" />+
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() =>
                              adjustVote(row, "downvote_count", -parseStep(downvoteInput[row.id]))
                            }
                          >
                            <ThumbsDown className="h-3 w-3 mr-1 opacity-60" />−
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="text-xs text-muted-foreground w-full">鎖定時間（分鐘）</span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={shieldInput[row.id] ?? ""}
                            onChange={(e) =>
                              setShieldInput((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                            placeholder="1"
                            className="h-8 w-20"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={disabled}
                            onClick={() => adjustShield(row, parseStep(shieldInput[row.id]))}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            增加
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={disabled}
                            onClick={() => adjustShield(row, -parseStep(shieldInput[row.id]))}
                          >
                            <Minus className="h-3 w-3 mr-1" />
                            減少
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯觀點內文</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            maxLength={CONTENT_MAX}
            className="min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground">
            {editContent.length}/{CONTENT_MAX} 字
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button onClick={saveEdit} disabled={!!busyId}>
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
