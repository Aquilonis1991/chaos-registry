import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Coins, Gift, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVoteHistory } from "@/hooks/useVoteHistory";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

const VoteHistoryPage = () => {
  const { user } = useAuth();
  const { history, loading } = useVoteHistory(user?.id);
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);

  const headerTitle = getText('voteHistory.header.title', '投票紀錄');
  const headerSubtitle = getText('voteHistory.header.subtitle', '查看你的投票歷史');
  const emptyStateText = getText('voteHistory.empty.text', '還沒有參與過的投票');
  const emptyStateButton = getText('voteHistory.empty.button', '開始投票');
  const freeVoteLabel = getText('voteHistory.badge.freeVote', '免費票');
  const optionLabelTemplate = getText('voteHistory.option.label', '選項：{{option}}');
  const statusActive = getText('voteHistory.status.active', '進行中');
  const statusClosed = getText('voteHistory.status.closed', '已結束');

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
            {history.map((vote) => (
              <Card key={vote.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <Link to={`/vote/${vote.topic_id}`}>
                        <h3 className="font-semibold text-foreground hover:text-primary transition-colors mb-2">
                          {vote.topic_title}
                        </h3>
                      </Link>
                      <div className="flex flex-wrap gap-2 mb-2">
                      {vote.topic_tags && vote.topic_tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      {vote.is_free_vote ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Gift className="w-4 h-4" />
                          <span className="text-sm font-semibold">{freeVoteLabel}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-primary">
                          <Coins className="w-4 h-4" />
                          <span className="text-sm font-semibold">{vote.tokens_used || 0}</span>
                        </div>
                      )}
                      {vote.option_selected && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {optionLabelTemplate.replace('{{option}}', vote.option_selected)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {formatDistanceToNow(new Date(vote.voted_at), { 
                          addSuffix: true, 
                          locale: zhTW 
                        })}
                      </span>
                    </div>
                    <Badge 
                      variant={vote.topic_status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {vote.topic_status === 'active' ? statusActive : statusClosed}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoteHistoryPage;
