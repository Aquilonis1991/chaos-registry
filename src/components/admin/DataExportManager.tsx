
import { useState } from "react";
import { LoadingBubble } from "@/components/ui/LoadingBubble";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadCSV } from "@/utils/exportUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const DataExportManager = () => {
    const [loading, setLoading] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState("30"); // days, 'all' for all time

    const calculateDateRange = () => {
        if (dateRange === "all") return { start: null, end: null };
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - parseInt(dateRange));
        return { start: start.toISOString(), end: end.toISOString() };
    };

    const handleExportUsers = async () => {
        try {
            setLoading("users");
            const { start, end } = calculateDateRange();

            const { data, error } = await (supabase as any).rpc('admin_export_users_v2', {
                p_start_date: start,
                p_end_date: end
            });

            if (error) throw error;

            if (!data || data.length === 0) {
                toast.info("此區間無資料可匯出");
                return;
            }

            downloadCSV("users_export", [
                { key: "user_id", label: "用戶ID" },
                { key: "nickname", label: "暱稱" },
                { key: "email", label: "信箱" },
                { key: "created_at", label: "註冊時間" },
                { key: "last_sign_in_at", label: "最後登入" },
                { key: "token_balance", label: "失序值餘額" },
                { key: "is_banned", label: "停權狀態" },
            ], data);

            toast.success(`成功匯出 ${data.length} 筆用戶資料`);
        } catch (error: any) {
            toast.error("匯出失敗: " + error.message);
        } finally {
            setLoading(null);
        }
    };

    const handleExportTopics = async () => {
        try {
            setLoading("topics");
            const { start, end } = calculateDateRange();

            const { data, error } = await (supabase as any).rpc('admin_export_topic_stats_v2', {
                p_start_date: start,
                p_end_date: end
            });

            if (error) throw error;

            if (!data || data.length === 0) {
                toast.info("此區間無資料可匯出");
                return;
            }

            // 注意：RPC 返回的是每個選項一行 (Flat format)，這最適合 CSV 分析
            downloadCSV("topics_stats_export", [
                { key: "topic_id", label: "主題ID" },
                { key: "created_at", label: "建立時間" },
                { key: "title", label: "主題標題" },
                { key: "status", label: "狀態" },
                { key: "total_votes", label: "主題總票數" },
                { key: "topic_unique_voters", label: "主題實際參與人數" },
                { key: "option_label", label: "選項名稱" },
                { key: "option_votes", label: "選項票數" },
                { key: "option_free_unique_voters", label: "選項不重複人數(免費票)" },
            ], data);

            toast.success(`成功匯出 ${data.length} 筆主題細節資料`);
        } catch (error: any) {
            toast.error("匯出失敗: " + error.message);
        } finally {
            setLoading(null);
        }
    };

    const handleExportTransactions = async () => {
        try {
            setLoading("transactions");
            const { start, end } = calculateDateRange();

            const { data, error } = await (supabase as any).rpc('admin_export_transactions_v2', {
                p_start_date: start,
                p_end_date: end
            });

            if (error) throw error;

            if (!data || data.length === 0) {
                toast.info("此區間無資料可匯出");
                return;
            }

            downloadCSV("transactions_export", [
                { key: "transaction_id", label: "交易ID" },
                { key: "created_at", label: "交易時間" },
                { key: "user_id", label: "用戶固定ID" },
                { key: "nickname", label: "用戶暱稱" },
                { key: "email", label: "用戶Email" },
                { key: "type", label: "交易類型" },
                { key: "amount", label: "金額" },
                { key: "description", label: "描述" },
            ], data);

            toast.success(`成功匯出 ${data.length} 筆交易資料`);
        } catch (error: any) {
            toast.error("匯出失敗: " + error.message);
        } finally {
            setLoading(null);
        }
    };

    const handleExportArenaMessages = async () => {
        try {
            setLoading("arena");
            const { start, end } = calculateDateRange();

            let query = supabase
                .from("topic_arena_messages")
                .select("id, topic_id, user_id, content, ttl_minutes, shield_until, upvote_count, downvote_count, is_legacy, created_at, updated_at, recycled_at")
                .order("created_at", { ascending: false });

            if (start && end) {
                query = query.gte("created_at", start).lte("created_at", end);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                toast.info("此區間無資料可匯出");
                return;
            }

            const rows = data as Array<{
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
            }>;

            const topicIds = [...new Set(rows.map((r) => r.topic_id))];
            const userIds = [...new Set(rows.map((r) => r.user_id))];

            const topicMap: Record<string, { title: string; status: string | null; end_at: string | null }> = {};
            const userMap: Record<string, string> = {};

            if (topicIds.length > 0) {
                const { data: topicsData, error: topicError } = await supabase
                    .from("topics")
                    .select("id, title, status, end_at")
                    .in("id", topicIds);
                if (topicError) throw topicError;
                (topicsData || []).forEach((t: any) => {
                    topicMap[t.id] = {
                        title: t.title ?? "",
                        status: t.status ?? null,
                        end_at: t.end_at ?? null
                    };
                });
            }

            if (userIds.length > 0) {
                const { data: usersData, error: userError } = await supabase
                    .from("profiles")
                    .select("id, nickname")
                    .in("id", userIds);
                if (userError) throw userError;
                (usersData || []).forEach((u: any) => {
                    userMap[u.id] = (u.nickname && String(u.nickname).trim()) || "";
                });
            }

            const exportRows = rows.map((row) => {
                const topic = topicMap[row.topic_id];
                const topicEnded = !!topic && (topic.status === "ended" || (!!topic.end_at && new Date(topic.end_at) <= new Date()));
                const locked = !!row.shield_until && new Date(row.shield_until) > new Date();

                let messageStatus = "顯示中";
                if (row.recycled_at) messageStatus = "已回收";
                else if (topicEnded) messageStatus = "封存";
                else if (locked) messageStatus = "鎖定中";

                return {
                    message_id: row.id,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    topic_id: row.topic_id,
                    topic_title: topic?.title ?? "",
                    topic_status: topic?.status ?? "",
                    user_id: row.user_id,
                    user_nickname: userMap[row.user_id] ?? "",
                    content: row.content,
                    message_status: messageStatus,
                    ttl_minutes: row.ttl_minutes,
                    shield_until: row.shield_until ?? "",
                    recycled_at: row.recycled_at ?? "",
                    upvote_count: row.upvote_count,
                    downvote_count: row.downvote_count,
                    net_score: row.upvote_count - row.downvote_count,
                    is_legacy: row.is_legacy ? "true" : "false",
                };
            });

            downloadCSV("arena_messages_export", [
                { key: "message_id", label: "留言ID" },
                { key: "created_at", label: "建立時間" },
                { key: "updated_at", label: "更新時間" },
                { key: "topic_id", label: "話題ID" },
                { key: "topic_title", label: "話題標題" },
                { key: "topic_status", label: "話題狀態" },
                { key: "user_id", label: "用戶ID" },
                { key: "user_nickname", label: "用戶暱稱" },
                { key: "content", label: "留言內容" },
                { key: "message_status", label: "留言狀態" },
                { key: "ttl_minutes", label: "存在週期(分鐘)" },
                { key: "shield_until", label: "鎖定到期時間" },
                { key: "recycled_at", label: "回收時間" },
                { key: "upvote_count", label: "贊同數" },
                { key: "downvote_count", label: "斥責數" },
                { key: "net_score", label: "淨分數" },
                { key: "is_legacy", label: "舊資料標記" },
            ], exportRows);

            toast.success(`成功匯出 ${exportRows.length} 筆角鬥場留言資料`);
        } catch (error: any) {
            toast.error("匯出失敗: " + error.message);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <LoadingBubble
                isLoading={loading !== null}
                textKey="loading.exporting_data"
                defaultText="正在匯出數據，請稍候..."
            />
            <div className="flex items-center space-x-4 mb-6 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* 用戶數據卡片 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            用戶數據
                        </CardTitle>
                        <CardDescription>
                            匯出所有註冊用戶清單、餘額與狀態
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            className="w-full"
                            onClick={handleExportUsers}
                            disabled={loading !== null}
                            variant="outline"
                        >
                            {loading === "users" ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            匯出 CSV
                        </Button>
                    </CardContent>
                </Card>

                {/* 主題統計卡片 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            主題詳細統計
                        </CardTitle>
                        <CardDescription>
                            包含每個選項的得票數、實際參與人數分析
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            className="w-full"
                            onClick={handleExportTopics}
                            disabled={loading !== null}
                            variant="outline"
                        >
                            {loading === "topics" ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            匯出 CSV
                        </Button>
                    </CardContent>
                </Card>

                {/* 財務流水卡片 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            財務交易紀錄
                        </CardTitle>
                        <CardDescription>
                            匯出所有失序值變動、投票消費與儲值紀錄
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            className="w-full"
                            onClick={handleExportTransactions}
                            disabled={loading !== null}
                            variant="outline"
                        >
                            {loading === "transactions" ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            匯出 CSV
                        </Button>
                    </CardContent>
                </Card>

                {/* 角鬥場留言卡片 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            角鬥場留言數據
                        </CardTitle>
                        <CardDescription>
                            匯出觀點角鬥場留言、狀態、鎖定時間與贊同/斥責統計
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            className="w-full"
                            onClick={handleExportArenaMessages}
                            disabled={loading !== null}
                            variant="outline"
                        >
                            {loading === "arena" ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            匯出 CSV
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
