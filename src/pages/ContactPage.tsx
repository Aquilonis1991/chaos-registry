import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

const ContactPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const headerTitle = getText('contact.header.title', '聯絡我們');
  const headerSubtitle = getText('contact.header.subtitle', '我們會盡快回覆您的訊息');
  const formTitle = getText('contact.form.title', '填寫聯絡表單');
  const categoryLabel = getText('contact.form.categoryLabel', '分類 *');
  const categoryPlaceholder = getText('contact.form.categoryPlaceholder', '請選擇分類');
  const titleLabel = getText('contact.form.titleLabel', '標題 *');
  const titlePlaceholder = getText('contact.form.titlePlaceholder', '請輸入標題');
  const contentLabel = getText('contact.form.contentLabel', '內容 *');
  const contentPlaceholder = getText('contact.form.contentPlaceholder', '請詳細描述您的問題或建議...');
  const submitButton = getText('contact.form.submit', '送出');
  const submittingButton = getText('contact.form.submitting', '送出中...');
  const loginRequiredText = getText('contact.toast.loginRequired', '請先登入');
  const categoryRequiredText = getText('contact.toast.categoryRequired', '請選擇分類');
  const titleRequiredText = getText('contact.toast.titleRequired', '請輸入標題');
  const contentRequiredText = getText('contact.toast.contentRequired', '請輸入內容');
  const submitSuccessText = getText('contact.toast.success', '訊息已送出，我們會盡快回覆您');
  const submitFailureText = getText('contact.toast.failure', '送出失敗，請稍後再試');
  const categoryOptions = [
    { value: "bug", label: getText('contact.category.bug', '錯誤回報') },
    { value: "suggestion", label: getText('contact.category.suggestion', '建議') },
    { value: "question", label: getText('contact.category.question', '問題詢問') },
    { value: "complaint", label: getText('contact.category.complaint', '投訴') },
    { value: "other", label: getText('contact.category.other', '其他') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error(loginRequiredText);
      navigate("/auth");
      return;
    }

    if (!category) {
      toast.error(categoryRequiredText);
      return;
    }

    if (!title.trim()) {
      toast.error(titleRequiredText);
      return;
    }

    if (!content.trim()) {
      toast.error(contentRequiredText);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('contact_messages')
        .insert({
          user_id: user.id,
          category,
          title: title.trim(),
          content: content.trim(),
        });

      if (error) throw error;

      toast.success(submitSuccessText);
      setCategory("");
      setTitle("");
      setContent("");
      navigate("/profile");
    } catch (error: any) {
      console.error("Submit contact message error:", error);
      toast.error(submitFailureText);
    } finally {
      setLoading(false);
    }
  };

  if (uiTextsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/profile">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">{headerTitle}</h1>
              <p className="text-sm text-primary-foreground/80">{headerSubtitle}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>{formTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">{categoryLabel}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder={categoryPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">{titleLabel}</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={titlePlaceholder}
                  maxLength={100}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">{contentLabel}</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={contentPlaceholder}
                  rows={8}
                  maxLength={2000}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {content.length} / 2000
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {submittingButton}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {submitButton}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContactPage;

