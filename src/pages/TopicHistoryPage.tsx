import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Users, Calendar, Clock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTopicHistory } from "@/hooks/useTopicHistory";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { zhTW } from "date-fns/locale";
import { EditTopicDialog } from "@/components/EditTopicDialog";
import { DeleteTopicDialog } from "@/components/DeleteTopicDialog";

const TopicHistoryPage = () => {
  const { user } = useAuth();
  const { topics, loading, refetch } = useTopicHistory(user?.id);

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
              <h1 className="text-xl font-bold text-primary-foreground">主題發起紀錄</h1>
              <p className="text-sm text-primary-foreground/80">查看你發起的主題</p>
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
                <p className="text-muted-foreground text-lg mb-4">還沒有發起過的主題</p>
                <Button asChild>
                  <Link to="/create">發起主題</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => {
              const isActive = topic.status === 'active' && new Date(topic.end_at) > new Date();
              const timeRemaining = isActive 
                ? formatDistanceToNow(new Date(topic.end_at), { locale: zhTW })
                : '已結束';
              
              return (
                <Card key={topic.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <Link to={`/vote/${topic.id}`}>
                          <h3 className="font-semibold text-foreground hover:text-primary transition-colors mb-2">
                            {topic.title}
                          </h3>
                        </Link>
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
                        {isActive ? '進行中' : '已結束'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{topic.total_votes} 票</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="w-4 h-4" />
                        <span>{topic.options.length} 選項</span>
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
                                <span className="text-xs font-semibold">{option.votes || 0} 票</span>
                              </div>
                              <Progress value={percentage} className="h-1" />
                            </div>
                          );
                        })}
                        {topic.options.length > 2 && (
                          <p className="text-xs text-muted-foreground text-center">
                            還有 {topic.options.length - 2} 個選項...
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {formatDistanceToNow(new Date(topic.created_at), { 
                              addSuffix: true, 
                              locale: zhTW 
                            })}
                          </span>
                        </div>
                        <Link to={`/vote/${topic.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs h-7">
                            查看詳情
                          </Button>
                        </Link>
                      </div>

                      {/* 編輯/刪除按鈕 */}
                      {differenceInHours(new Date(), new Date(topic.created_at)) < 1 && (
                        <div className="flex gap-2">
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicHistoryPage;
