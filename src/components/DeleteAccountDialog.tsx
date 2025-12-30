import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Loader2, AlertTriangle, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";

export const DeleteAccountDialog = () => {
    const { language } = useLanguage();
    const { getText } = useUIText(language);
    const { signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmText, setConfirmText] = useState("");

    // 確認關鍵字：DELETE
    const CONFIRM_KEYWORD = "DELETE";

    const handleDelete = async () => {
        if (confirmText !== CONFIRM_KEYWORD) return;

        setIsDeleting(true);

        try {
            // 呼叫 RPC
            const { data, error } = await (supabase.rpc as any)('user_self_delete', {
                p_reason: 'user_requested_via_app'
            });

            if (error) throw error;

            // 檢查回傳結果
            if (data && (data as any).success === false) {
                throw new Error((data as any).error || 'Unknown error');
            }

            toast.success(getText('deleteAccount.success', '帳號已成功刪除'));

            // 登出並跳轉
            await signOut();
            window.location.href = '/';

        } catch (error: any) {
            console.error('Error deleting account:', error);
            toast.error(getText('deleteAccount.error', '刪除失敗，請聯絡客服'), {
                description: error.message
            });
            setIsDeleting(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setConfirmText("");
        }
        setOpen(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-destructive/10 transition-colors group">
                    <div className="flex items-center gap-3">
                        <Trash2 className="w-5 h-5 text-destructive group-hover:text-destructive" />
                        <span className="font-medium text-destructive">{getText('deleteAccount.button', '刪除帳號')}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-destructive" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md border-destructive/20">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-5 h-5" />
                        {getText('deleteAccount.title', '確認刪除帳號？')}
                    </DialogTitle>
                    <DialogDescription className="space-y-2 pt-2">
                        <p>
                            {getText('deleteAccount.warning1', '此動作無法復原。您的帳號將被永久刪除，所有代幣與權限將被移除。')}
                        </p>
                        <p className="font-semibold text-foreground">
                            {getText('deleteAccount.warning2', '請輸入 "DELETE" 以確認刪除：')}
                        </p>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="border-destructive/50 focus-visible:ring-destructive"
                    />

                    <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                            {getText('deleteAccount.alert', '帳號刪除後將無法取回任何資料。')}
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter className="flex-row gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isDeleting}
                        className="flex-1"
                    >
                        {getText('common.button.cancel', '取消')}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting || confirmText !== CONFIRM_KEYWORD}
                        className="flex-1"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {getText('deleteAccount.deleting', '刪除中...')}
                            </>
                        ) : (
                            getText('deleteAccount.confirm', '確認刪除')
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
