
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

            const { data, error } = await supabase.rpc('admin_export_users_v2', {
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
                { key: "token_balance", label: "代幣餘額" },
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

            const { data, error } = await supabase.rpc('admin_export_topic_stats_v2', {
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

            const { data, error } = await supabase.rpc('admin_export_transactions_v2', {
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            匯出所有代幣變動、投票消費與儲值紀錄
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
            </div>
        </div>
    );
};
