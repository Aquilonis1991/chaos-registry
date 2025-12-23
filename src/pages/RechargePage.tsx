import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Wallet, Zap, Crown, Star, Gift, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { usePurchase } from "@/hooks/usePurchase";

const tokenPackages = [
  { 
    id: 1, 
    tokens: 100, 
    price: 30, 
    icon: Coins,
    popular: false,
    bonus: 0
  },
  { 
    id: 2, 
    tokens: 500, 
    price: 150, 
    icon: Zap,
    popular: true,
    bonus: 50
  },
  { 
    id: 3, 
    tokens: 1000, 
    price: 280, 
    icon: Star,
    popular: false,
    bonus: 150
  },
  { 
    id: 4, 
    tokens: 3000, 
    price: 800, 
    icon: Crown,
    popular: false,
    bonus: 500
  },
];

const RechargePage = () => {
  const { toast: toastHook } = useToast();
  const { profile, refreshProfile } = useProfile();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);
  const { purchaseTokenPack, isProcessing } = usePurchase();
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);

  const userTokens = profile?.tokens || 0;

  const headerTitle = getText('recharge.header.title', '代幣儲值');
  const headerSubtitle = getText('recharge.header.subtitle', '購買代幣參與更多投票');
  const loginRequiredText = getText('recharge.toast.loginRequired', '請先登入');
  const restrictionFallbackText = getText('recharge.toast.restricted', '儲值功能已被暫停');
  const purchaseSuccessTitle = getText('recharge.toast.success.title', '購買成功！');
  const purchaseSuccessDescTemplate = getText('recharge.toast.success.desc', '已獲得 {{amount}} 代幣');
  const purchaseFailureTitle = getText('recharge.toast.failure.title', '購買失敗');
  const purchaseFailureDesc = getText('recharge.toast.failure.desc', '請稍後再試');
  const balanceLabel = getText('recharge.balance.label', '當前代幣餘額');
  const packagesTitle = getText('recharge.packages.title', '選擇儲值方案');
  const bestValueBadgeText = getText('recharge.packages.bestValue', '最超值');
  const tokenUnitText = getText('recharge.packages.tokenUnit', '代幣');
  const bonusBadgeTemplate = getText('recharge.packages.bonus', '+{{amount}} 贈送');
  const purchaseButtonText = getText('recharge.packages.buy', '購買');
  const processingText = getText('recharge.packages.processing', '處理中...');
  const infoCardTitle = getText('recharge.info.title', '💡 儲值說明');
  const infoCardItems = [
    getText('recharge.info.item1', '• 代幣可用於投票、發起主題等功能'),
    getText('recharge.info.item2', '• 儲值金額越高，贈送代幣越多'),
    getText('recharge.info.item3', '• 完成每日任務也可免費獲得代幣'),
    getText('recharge.info.item4', '• 代幣永久有效，不會過期'),
  ];
  const mobileNoteTitle = getText('recharge.mobile.title', '📱 關於行動應用內購');
  const mobileNoteDescription = getText('recharge.mobile.description', '如需整合 Google Play 或 App Store 內購功能，需要使用 Capacitor 將應用打包為原生行動應用。目前的網頁版使用模擬購買流程。');

  const handlePurchase = async (pkg: typeof tokenPackages[0]) => {
    setSelectedPackage(pkg.id);
    try {
      await purchaseTokenPack(pkg.id);
      // 購買成功後，usePurchase hook 會自動刷新代幣
    } catch (error) {
      // 錯誤已在 usePurchase 中處理
    } finally {
      setTimeout(() => setSelectedPackage(null), 2000);
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
            <Wallet className="w-7 h-7 text-accent" />
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">{headerTitle}</h1>
              <p className="text-sm text-primary-foreground/80">{headerSubtitle}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Current Balance */}
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{balanceLabel}</p>
                <div className="flex items-center gap-2">
                  <Coins className="w-6 h-6 text-accent" />
                  <span className="text-3xl font-bold text-foreground">{userTokens.toLocaleString()}</span>
                </div>
              </div>
              <Gift className="w-12 h-12 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        {/* Packages */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground mb-4">{packagesTitle}</h2>
          {tokenPackages.map((pkg) => {
            const Icon = pkg.icon;
            return (
              <Card 
                key={pkg.id} 
                className={`bg-gradient-card shadow-card hover:shadow-glow transition-all relative ${
                  pkg.popular ? 'ring-2 ring-primary' : ''
                }`}
              >
                {pkg.popular && (
                  <Badge className="absolute -top-2 left-4 bg-primary text-primary-foreground">
                    {bestValueBadgeText}
                  </Badge>
                )}
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
                      <Icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-2xl font-bold text-foreground">
                          {pkg.tokens}
                        </span>
                        <span className="text-sm text-muted-foreground">{tokenUnitText}</span>
                        {pkg.bonus > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {bonusBadgeTemplate.replace('{{amount}}', pkg.bonus.toString())}
                          </Badge>
                        )}
                      </div>
                      <p className="text-lg font-semibold text-primary">
                        NT$ {pkg.price}
                      </p>
                    </div>
                    
                    <Button
                      onClick={() => handlePurchase(pkg)}
                      disabled={selectedPackage === pkg.id || isProcessing}
                      className="flex-shrink-0"
                      variant={pkg.popular ? "default" : "outline"}
                    >
                      {selectedPackage === pkg.id || isProcessing ? processingText : purchaseButtonText}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Card */}
        <Card className="bg-muted/50 border-muted">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-2">{infoCardTitle}</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {infoCardItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Mobile App In-App Purchase Note */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-2">{mobileNoteTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {mobileNoteDescription}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RechargePage;
