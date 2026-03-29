import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

type RedeemCodeRow = {
  id: string;
  code: string;
  reward_type: string;
  token_amount: number;
  valid_from: string;
  valid_until: string;
  max_redemptions: number | null;
  redemption_count: number;
  is_active: boolean;
  created_at: string;
};

const parseList = (raw: unknown): RedeemCodeRow[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as RedeemCodeRow[];
  return [];
};

const RedeemCodeManager = () => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const [rows, setRows] = useState<RedeemCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formCode, setFormCode] = useState("");
  const [formTokens, setFormTokens] = useState("100");
  const [formFrom, setFormFrom] = useState("");
  const [formUntil, setFormUntil] = useState("");
  const [formMax, setFormMax] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_redeem_codes");
      if (error) throw error;
      setRows(parseList(data));
    } catch {
      toast.error(getText("admin.redeemCodes.error.load", "載入兌換碼失敗"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const toLocal = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
    setFormCode("");
    setFormTokens("100");
    setFormFrom(toLocal(now));
    setFormUntil(toLocal(week));
    setFormMax("");
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    const amount = Number(formTokens);
    if (!formCode.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error(getText("redeemCode.error.invalid_input", "請輸入有效兌換碼"));
      return;
    }
    const from = new Date(formFrom);
    const until = new Date(formUntil);
    if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime()) || until < from) {
      toast.error(getText("redeemCode.error.invalid_input", "請輸入有效兌換碼"));
      return;
    }
    const maxRaw = formMax.trim();
    let pMaxRedemptions: number | null = null;
    if (maxRaw !== "") {
      const n = Number(maxRaw);
      if (!Number.isFinite(n) || n < 0) {
        toast.error(getText("redeemCode.error.invalid_input", "請輸入有效兌換碼"));
        return;
      }
      pMaxRedemptions = n;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("admin_create_redeem_code", {
        p_code: formCode.trim(),
        p_token_amount: amount,
        p_valid_from: from.toISOString(),
        p_valid_until: until.toISOString(),
        p_max_redemptions: pMaxRedemptions,
      });
      if (error) throw error;
      toast.success(getText("admin.redeemCodes.toast.createOk", "已建立兌換碼"));
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "";
      toast.error(msg || getText("redeemCode.error.generic", "兌換失敗，請稍後再試"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStop = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc("admin_deactivate_redeem_code", { p_id: id });
      if (error) throw error;
      const res = data as { success?: boolean };
      if (!res?.success) {
        toast.error(getText("redeemCode.error.generic", "兌換失敗，請稍後再試"));
        return;
      }
      toast.success(getText("admin.redeemCodes.toast.stopOk", "已停止此兌換碼"));
      await load();
    } catch {
      toast.error(getText("redeemCode.error.generic", "兌換失敗，請稍後再試"));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc("admin_delete_redeem_code", { p_id: deleteTarget.id });
      if (error) throw error;
      const res = data as { success?: boolean };
      if (!res?.success) {
        toast.error(getText("redeemCode.error.generic", "兌換失敗，請稍後再試"));
        return;
      }
      toast.success(getText("admin.redeemCodes.toast.removeOk", "已刪除兌換碼"));
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error(getText("redeemCode.error.generic", "兌換失敗，請稍後再試"));
    } finally {
      setDeleting(false);
    }
  };

  const df = (iso: string) => {
    try {
      return format(new Date(iso), "yyyy/MM/dd HH:mm", { locale: language === "zh" ? zhTW : undefined });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{getText("admin.redeemCodes.pageTitle", "兌換碼管理")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {getText("admin.redeemCodes.pageDesc", "新增活動兌換碼、設定代幣數量與可兌換期間。")}
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          {getText("admin.redeemCodes.addButton", "新增兌換碼")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{getText("admin.redeemCodes.col.code", "兌換碼")}</TableHead>
                    <TableHead>{getText("admin.redeemCodes.col.reward", "品項")}</TableHead>
                    <TableHead>{getText("admin.redeemCodes.col.tokens", "代幣數量")}</TableHead>
                    <TableHead>{getText("admin.redeemCodes.col.validFrom", "開始")}</TableHead>
                    <TableHead>{getText("admin.redeemCodes.col.validUntil", "結束")}</TableHead>
                    <TableHead>{getText("admin.redeemCodes.col.maxRedemptions", "總上限")}</TableHead>
                    <TableHead>{getText("admin.redeemCodes.col.redeemed", "已兌換")}</TableHead>
                    <TableHead>{getText("admin.redeemCodes.col.status", "狀態")}</TableHead>
                    <TableHead className="min-w-[11rem] text-right">{getText("admin.redeemCodes.col.actions", "操作")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        —
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono font-medium">{r.code}</TableCell>
                        <TableCell>
                          {r.reward_type === "tokens"
                            ? getText("admin.redeemCodes.reward.tokens", "代幣")
                            : r.reward_type}
                        </TableCell>
                        <TableCell>{r.token_amount}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{df(r.valid_from)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{df(r.valid_until)}</TableCell>
                        <TableCell>
                          {r.max_redemptions == null || r.max_redemptions === 0
                            ? getText("admin.redeemCodes.unlimited", "不限")
                            : r.max_redemptions}
                        </TableCell>
                        <TableCell>{r.redemption_count}</TableCell>
                        <TableCell>
                          <Badge variant={r.is_active ? "default" : "secondary"}>
                            {r.is_active
                              ? getText("admin.redeemCodes.status.active", "啟用")
                              : getText("admin.redeemCodes.status.inactive", "已停用")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {r.is_active && (
                              <Button type="button" variant="outline" size="sm" onClick={() => handleStop(r.id)}>
                                {getText("admin.redeemCodes.stop", "停止")}
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget({ id: r.id, code: r.code })}
                            >
                              {getText("admin.redeemCodes.delete", "刪除")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText("admin.redeemCodes.confirmDeleteTitle", "確定刪除？")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? getText(
                    "admin.redeemCodes.confirmDeleteDesc",
                    "將永久移除「{{code}}」與其兌換紀錄，無法復原。",
                  ).replace(/\{\{code\}\}/g, deleteTarget.code)
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{getText("admin.redeemCodes.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : getText("admin.redeemCodes.confirmDeleteConfirm", "確定刪除")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getText("admin.redeemCodes.dialogTitle", "新增兌換碼")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{getText("admin.redeemCodes.form.code", "兌換碼")}</Label>
              <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="WELCOME2026" />
            </div>
            <div className="space-y-2">
              <Label>{getText("admin.redeemCodes.form.tokenAmount", "代幣數量")}</Label>
              <Input
                type="number"
                min={1}
                value={formTokens}
                onChange={(e) => setFormTokens(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{getText("admin.redeemCodes.form.validFrom", "可兌換開始時間")}</Label>
              <Input type="datetime-local" value={formFrom} onChange={(e) => setFormFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{getText("admin.redeemCodes.form.validUntil", "可兌換結束時間")}</Label>
              <Input type="datetime-local" value={formUntil} onChange={(e) => setFormUntil(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{getText("admin.redeemCodes.form.maxRedemptions", "總兌換次數上限（選填）")}</Label>
              <Input
                type="number"
                min={0}
                placeholder={getText("admin.redeemCodes.unlimited", "不限")}
                value={formMax}
                onChange={(e) => setFormMax(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {getText("admin.redeemCodes.form.maxRedemptionsHint", "留空表示不限總次數")}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {getText("admin.redeemCodes.cancel", "取消")}
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : getText("admin.redeemCodes.submit", "建立")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RedeemCodeManager;
