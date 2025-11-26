import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTokenHistory } from "@/hooks/useTokenHistory";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { formatRelativeTime } from "@/lib/relativeTime";

const TokenUsageHistoryPage = () => {
  const { user } = useAuth();
  const { history, loading } = useTokenHistory(user?.id);
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);

  // 調試日誌：檢查傳入的歷史記錄
  console.log('📊 TokenUsageHistoryPage - history data:', {
    count: history.length,
    transactions: history.map(t => ({
      id: t.id,
      type: t.transaction_type,
      amount: t.amount,
      amountType: typeof t.amount,
      label: t.type_label,
      isExpense: t.amount < 0,
      isIncome: t.amount > 0
    })),
    expenseCount: history.filter(t => t.amount < 0).length,
    incomeCount: history.filter(t => t.amount > 0).length
  });

  const headerTitle = getText('tokenHistory.header.title', '代幣使用紀錄');
  const headerSubtitle = getText('tokenHistory.header.subtitle', '查看你的代幣使用歷史');
  const emptyStateText = getText('tokenHistory.empty.text', '還沒有使用紀錄');
  const emptyStateButton = getText('tokenHistory.empty.button', '開始使用');
  const incomeBadge = getText('tokenHistory.badge.income', '收入');
  const expenseBadge = getText('tokenHistory.badge.expense', '支出');

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
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="text-center">
                <p className="text-muted-foreground text-lg mb-4">{emptyStateText}</p>
                <Button asChild>
                  <Link to="/home">{emptyStateButton}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {history.map((transaction) => {
              const isIncome = transaction.amount > 0;
              
              return (
                <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-2xl">{transaction.type_icon}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">
                            {transaction.type_label}
                          </h3>
                          {transaction.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {transaction.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {formatRelativeTime(new Date(transaction.created_at), getText)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        <div className={`flex items-center gap-1 font-bold text-lg ${
                          isIncome ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {isIncome ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                          <span>
                            {isIncome ? '+' : ''}{typeof transaction.amount === 'number' ? transaction.amount : parseFloat(String(transaction.amount)) || 0}
                          </span>
                        </div>
                        <Badge 
                          variant={isIncome ? 'default' : 'secondary'}
                          className="text-xs mt-1"
                        >
                          {isIncome ? incomeBadge : expenseBadge}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenUsageHistoryPage;
