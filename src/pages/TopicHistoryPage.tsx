import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Users, Calendar, Clock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTopicHistory } from "@/hooks/useTopicHistory";
import { useAuth } from "@/hooks/useAuth";
import { differenceInHours } from "date-fns";
import { EditTopicDialog } from "@/components/EditTopicDialog";
import { DeleteTopicDialog } from "@/components/DeleteTopicDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { formatRelativeTime, formatRemainingTime } from "@/lib/relativeTime";
import { formatCompactNumber } from "@/lib/numberFormat";

const TopicHistoryPage = () => {
  const { user } = useAuth();
  const { topics, loading, refetch } = useTopicHistory(user?.id);
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);

  // UI 文字定義
  const headerTitle = getText('topicHistory.header.title', '主題發起紀錄');
  const headerSubtitle = getText('topicHistory.header.subtitle', '查看你發起的主題');
  const emptyStateText = getText('topicHistory.empty.text', '還沒有發起過的主題');
  const emptyStateButton = getText('topicHistory.empty.button', '發起主題');
  const statusActive = getText('topicHistory.status.active', '進行中');
  const statusEnded = getText('topicHistory.status.ended', '已結束');
  const votesLabel = getText('topicHistory.stats.votes', '票');
  const optionsLabel = getText('topicHistory.stats.options', '選項');
  const timeRemainingLabel = getText('topicHistory.stats.timeRemaining', '剩餘時間');
  const timeEnded = getText('topicHistory.stats.timeEnded', '已結束');
  const moreOptionsTemplate = getText('topicHistory.stats.moreOptions', '還有 {{count}} 個選項...');
  const viewDetailsLabel = getText('topicHistory.button.viewDetails', '查看詳情');

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
        ) : topics.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="text-center">
                <p className="text-muted-foreground text-lg mb-4">{emptyStateText}</p>
                <Button asChild>
                  <Link to="/create">{emptyStateButton}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => {
              const isActive = topic.status === 'active' && new Date(topic.end_at) > new Date();
              const timeRemaining = isActive 
                ? formatRemainingTime(new Date(topic.end_at), getText)
                : timeEnded;
              
              return (
                <Link key={topic.id} to={`/vote/${topic.id}`} className="block">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground hover:text-primary transition-colors mb-2">
                            {topic.title}
                          </h3>
                          {topic.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {topic.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mb-2">
                            {topic.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Badge 
                          variant={isActive ? 'default' : 'secondary'}
                          className="ml-4"
                        >
                          {isActive ? statusActive : statusEnded}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>{formatCompactNumber(topic.total_votes)} {votesLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <TrendingUp className="w-4 h-4" />
                          <span>{topic.options.length} {optionsLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{timeRemaining}</span>
                        </div>
                      </div>
                      
                      {topic.options.length > 0 && (
                        <div className="space-y-2">
                          {topic.options.slice(0, 2).map((option) => {
                            const percentage = topic.total_votes > 0 
                              ? ((option.votes || 0) / topic.total_votes) * 100 
                              : 0;
                            return (
                              <div key={option.id} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">{option.text}</span>
                                  <span className="text-xs font-semibold">
                                    {formatCompactNumber(option.votes || 0)} {votesLabel}
                                  </span>
                                </div>
                                <Progress value={percentage} className="h-1" />
                              </div>
                            );
                          })}
                          {topic.options.length > 2 && (
                            <p className="text-xs text-muted-foreground text-center">
                              {moreOptionsTemplate.replace('{{count}}', (topic.options.length - 2).toString())}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{formatRelativeTime(new Date(topic.created_at), getText)}</span>
                        </div>

                        {/* 編輯/刪除按鈕 */}
                        {differenceInHours(new Date(), new Date(topic.created_at)) < 1 && (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <EditTopicDialog
                              topicId={topic.id}
                              currentTitle={topic.title}
                              currentDescription={topic.description}
                              currentOptions={topic.options.map(opt => opt.text)}
                              createdAt={topic.created_at}
                              onEditSuccess={refetch}
                            />
                            <DeleteTopicDialog
                              topicId={topic.id}
                              topicTitle={topic.title}
                              navigateAfterDelete={false}
                              onDeleteSuccess={refetch}
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicHistoryPage;
