import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import LegalContentRenderer from "@/components/LegalContentRenderer";
import { DefaultPrivacySections } from "@/pages/PrivacyPage";
import { DefaultTermsSections } from "@/pages/TermsPage";

const LegalPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { loading: configLoading, getConfig } = useSystemConfigCache();

  const privacyContent = getConfig<string>('legal_privacy_content', '');
  const termsContent = getConfig<string>('legal_terms_content', '');
  const hasCustomPrivacy = !configLoading && typeof privacyContent === 'string' && privacyContent.trim().length > 0;
  const hasCustomTerms = !configLoading && typeof termsContent === 'string' && termsContent.trim().length > 0;

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">
                {getText('legalPage.header.title', '隱私權政策與服務條款')}
              </h1>
              <p className="text-xs text-primary-foreground/80">
                Privacy & Terms
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-8">
        {/* 隱私權政策 */}
        <Card>
          <CardContent className="p-6 space-y-6 prose prose-sm max-w-none">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">🔒 隱私權政策</h2>
              <p className="text-muted-foreground text-sm">
                {hasCustomPrivacy ? 'Privacy Policy' : '版本日期：2025 年 10 月'}
              </p>
            </div>
            {hasCustomPrivacy ? (
              <LegalContentRenderer content={privacyContent} />
            ) : (
              <DefaultPrivacySections />
            )}
          </CardContent>
        </Card>

        {/* 服務條款 */}
        <Card>
          <CardContent className="p-6 space-y-6 prose prose-sm max-w-none">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">📜 服務條款</h2>
              <p className="text-muted-foreground text-sm">
                {hasCustomTerms ? 'Terms of Service' : '版本日期：2025 年 10 月'}
              </p>
            </div>
            {hasCustomTerms ? (
              <LegalContentRenderer content={termsContent} />
            ) : (
              <DefaultTermsSections />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LegalPage;
