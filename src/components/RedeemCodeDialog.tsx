import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Gift, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useProfile } from "@/hooks/useProfile";

type RedeemResult = {
  success?: boolean;
  error?: string;
  tokens_added?: number;
};

export const RedeemCodeDialog = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { refreshProfile } = useProfile();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const errKey = (k: string) => `redeemCode.error.${k}`;

  const mapError = (err: string | undefined) => {
    const key = errKey(err || "generic");
    const fallback =
      err === "not_authenticated"
        ? "請先登入"
        : err === "invalid_input"
          ? "請輸入有效兌換碼"
          : err === "not_found"
            ? "查無此兌換碼或已停用"
            : err === "not_started"
              ? "此兌換碼尚未開放"
              : err === "expired"
                ? "此兌換碼已過期"
                : err === "exhausted"
                  ? "此兌換碼已達兌換上限"
                  : err === "already_redeemed"
                    ? "您已兌換過此碼"
                    : "兌換失敗，請稍後再試";
    return getText(key, fallback);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error(mapError("invalid_input"));
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("redeem_code", { p_code: trimmed });
      if (error) throw error;
      const result = data as RedeemResult;
      if (!result?.success) {
        toast.error(mapError(result?.error));
        return;
      }
      const amt = result.tokens_added ?? 0;
      toast.success(getText("redeemCode.success.toast", "兌換成功"), {
        description: getText("redeemCode.success.tokensAdded", "已發放 {{amount}} 失序值").replace(
          "{{amount}}",
          String(amt)
        ),
      });
      setCode("");
      setOpen(false);
      await refreshProfile();
      navigate("/history/token-usage");
    } catch {
      toast.error(getText("redeemCode.error.generic", "兌換失敗，請稍後再試"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCode("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Gift className="w-5 h-5 text-primary" />
            <span className="font-medium">{getText("profile.menu.redeemCode", "兌換碼")}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            {getText("redeemCode.dialog.title", "兌換碼")}
          </DialogTitle>
          <DialogDescription>
            {getText("redeemCode.dialog.description", "輸入活動兌換碼以領取代幣。")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleRedeem} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="redeem-code-input">{getText("redeemCode.form.label", "兌換碼")}</Label>
            <Input
              id="redeem-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={getText("redeemCode.form.placeholder", "請輸入兌換碼")}
              autoComplete="off"
              disabled={submitting}
            />
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting} className="flex-1">
              {getText("common.button.cancel", "取消")}
            </Button>
            <Button type="submit" disabled={submitting || !code.trim()} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {getText("common.loading", "處理中…")}
                </>
              ) : (
                getText("redeemCode.button.redeem", "兌換")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
