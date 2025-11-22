import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopicCard } from "@/components/TopicCard";
import { Button } from "@/components/ui/button";
import { PlusCircle, Coins, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AnnouncementCarousel } from "@/components/AnnouncementCarousel";
import { SearchBar } from "@/components/SearchBar";
import { useTopics } from "@/hooks/useTopics";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { formatRelativeTime } from "@/lib/relativeTime";
import { insertAdsIntoList } from "@/lib/adInsertion";

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);
  const { getConfig, refreshConfigs } = useSystemConfigCache();
  const [currentTab, setCurrentTab] = useState<'hot' | 'latest' | 'joined'>('hot');
  
  // 根據當前標籤獲取主題
  const { topics: hotTopics, loading: hotLoading } = useTopics({ 
    filter: 'hot', 
    limit: 20 
  });
  const { topics: latestTopics, loading: latestLoading } = useTopics({ 
    filter: 'latest', 
    limit: 20 
  });
  const { topics: joinedTopics, loading: joinedLoading } = useTopics({ 
    filter: 'joined', 
    userId: user?.id 
  });

  const promotedLimitConfig = getConfig('home_promoted_limit', 30);
  const promotedLimit = Number(promotedLimitConfig) || 30;

  const promotedHotTopics = hotTopics
    .filter((topic) => topic.current_exposure_level)
    .slice(0, promotedLimit);
  const promotedHotTopicIds = new Set(promotedHotTopics.map((topic) => topic.id));
  const hasNonPromotedHotTopics = hotTopics.some(
    (topic) => !promotedHotTopicIds.has(topic.id)
  );
  const shouldShowPromotedSection = promotedHotTopics.length > 0 && hasNonPromotedHotTopics;

  const regularHotTopics = shouldShowPromotedSection
    ? hotTopics.filter((topic) => !promotedHotTopicIds.has(topic.id))
    : hotTopics;

  // 廣告配置（從系統配置讀取）
  // 暫時降低 skipFirst 以便測試（實際使用時應從配置讀取）
  const adInsertionInterval = Number(getConfig('ad_insertion_interval', 10)) || 10;
  const adInsertionSkipFirst = Number(getConfig('ad_insertion_skip_first', 3)) || 3; // 暫時改為 3 以便測試
  const adUnitIdConfig = getConfig('admob_native_ad_unit_id', 'ca-app-pub-3940256099942544/2247696110');
  const adUnitId = typeof adUnitIdConfig === 'string' ? adUnitIdConfig : String(adUnitIdConfig || '');
  const adInsertionEnabledValue = getConfig('ad_insertion_enabled', true);
  const adInsertionEnabled = adInsertionEnabledValue === true || adInsertionEnabledValue === 'true' || String(adInsertionEnabledValue).toLowerCase() === 'true';
  
  const adConfig = {
    interval: adInsertionInterval,
    skipFirst: adInsertionSkipFirst,
    adUnitId: adUnitId,
    enabled: adInsertionEnabled,
  };

  const hotTabSkipFirst = shouldShowPromotedSection
    ? Math.max(0, adConfig.skipFirst - promotedHotTopics.length)
    : adConfig.skipFirst;

  // 調試信息（開發環境）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('廣告配置:', {
        enabled: adInsertionEnabled,
        interval: adInsertionInterval,
        skipFirst: adInsertionSkipFirst,
        adUnitId: adUnitId,
        hotTopicsCount: hotTopics.length,
        latestTopicsCount: latestTopics.length,
        joinedTopicsCount: joinedTopics.length,
      });
    }
  }, [adInsertionEnabled, adInsertionInterval, adInsertionSkipFirst, adUnitId, hotTopics.length, latestTopics.length, joinedTopics.length]);

  const userTokens = profile?.tokens || 0;

  const handleSearchSubmit = (term: string) => {
    const sanitized = term.trim();
    if (!sanitized) return;
    navigate(`/search?q=${encodeURIComponent(sanitized)}`);
  };

  if (uiTextsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatCreatedAt = (dateString: string) => formatRelativeTime(new Date(dateString), getText);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary-foreground">
                {getText('home.header.title', 'ChaosRegistry')}
              </h1>
              <p className="text-sm text-primary-foreground/80">
                {getText('home.header.subtitle', '不理性登記處')}
              </p>
            </div>
            
            <button 
              onClick={() => navigate('/recharge')}
              className="flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-primary-foreground/30 transition-colors cursor-pointer"
            >
              <Coins className="w-5 h-5 text-accent" />
              <span className="font-bold text-primary-foreground">{userTokens.toLocaleString()}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Announcements */}
        <div className="mb-6">
          <AnnouncementCarousel />
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar onSubmit={handleSearchSubmit} showHistory={true} />
        </div>

        <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as any)} className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-6 bg-muted h-12">
            <TabsTrigger value="hot" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {getText('home.tab.hot', '🔥 熱門')}
            </TabsTrigger>
            <TabsTrigger value="latest" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {getText('home.tab.latest', '⚡ 最新')}
            </TabsTrigger>
            <TabsTrigger value="joined" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {getText('home.tab.joined', '✅ 參與過')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hot" className="space-y-4 mt-0">
            {hotLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : hotTopics.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {getText('home.empty.hot', '目前沒有熱門主題')}
                </p>
                <Button variant="vote" asChild>
                  <Link to="/create">{getText('home.action.createFirst', '發起第一個主題')}</Link>
                </Button>
              </div>
            ) : (
              <>
                {/* 推廣主題區（前3個有曝光的主題） */}
                {shouldShowPromotedSection && (
                  <div className="mb-6">
                    <div className="mb-3 px-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {getText('home.hot.promoted', '推廣主題區（付費曝光）')}
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {promotedHotTopics.map((topic) => (
                        <div key={topic.id}>
                          <TopicCard 
                            id={topic.id}
                            title={topic.title}
                            tags={topic.tags}
                            voteCount={topic.total_votes || 0}
                            creatorName={topic.creator_name || getText('common.anonymous', '匿名')}
                            isHot={topic.is_hot}
                            createdAt={formatCreatedAt(topic.created_at)}
                            currentExposureLevel={topic.current_exposure_level || null}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 一般主題列表 */}
                {regularHotTopics.length > 0 && (
                  <div className="space-y-4">
                    {insertAdsIntoList(
                      regularHotTopics,
                      (topic, index) => (
                        <div key={topic.id}>
                          <TopicCard 
                            id={topic.id}
                            title={topic.title}
                            tags={topic.tags}
                            voteCount={topic.total_votes || 0}
                            creatorName={topic.creator_name || getText('common.anonymous', '匿名')}
                            isHot={topic.is_hot}
                            createdAt={formatCreatedAt(topic.created_at)}
                            currentExposureLevel={topic.current_exposure_level || null}
                          />
                        </div>
                      ),
                      {
                        ...adConfig,
                        adIndex: 0,
                        skipFirst: hotTabSkipFirst
                      }
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="latest" className="space-y-4 mt-0">
            {latestLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : latestTopics.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {getText('home.empty.latest', '目前沒有主題')}
                </p>
                <Button variant="vote" asChild>
                  <Link to="/create">{getText('home.action.createFirst', '發起第一個主題')}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {insertAdsIntoList(
                  latestTopics,
                  (topic) => (
                    <div key={topic.id}>
                      <TopicCard 
                        id={topic.id}
                        title={topic.title}
                        tags={topic.tags}
                        voteCount={topic.total_votes || 0}
                        creatorName={topic.creator_name || getText('common.anonymous', '匿名')}
                        isHot={topic.is_hot}
                        createdAt={formatCreatedAt(topic.created_at)}
                        currentExposureLevel={topic.current_exposure_level || null}
                      />
                    </div>
                  ),
                  { ...adConfig, adIndex: 100 }
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="joined" className="space-y-4 mt-0">
            {joinedLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : joinedTopics.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {getText('home.empty.joined', '還沒有參與過的投票')}
                </p>
                <Button variant="vote" asChild>
                  <Link to="/home">{getText('home.action.browse', '瀏覽主題')}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {insertAdsIntoList(
                  joinedTopics,
                  (topic) => (
                    <div key={topic.id}>
                      <TopicCard 
                        id={topic.id}
                        title={topic.title}
                        tags={topic.tags}
                        voteCount={topic.total_votes || 0}
                        creatorName={topic.creator_name || getText('common.anonymous', '匿名')}
                        isHot={topic.is_hot}
                        createdAt={formatCreatedAt(topic.created_at)}
                        currentExposureLevel={topic.current_exposure_level || null}
                      />
                    </div>
                  ),
                  { ...adConfig, adIndex: 200 }
                )}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>

      {/* Floating Action Button */}
      <Link to="/create">
        <Button
          variant="accent"
          size="lg"
          className="fixed bottom-24 right-6 rounded-full w-14 h-14 shadow-glow"
          aria-label={getText('home.fab.create', '發起主題')}
        >
          <PlusCircle className="w-6 h-6" />
          <span className="sr-only">{getText('home.fab.create', '發起主題')}</span>
        </Button>
      </Link>
    </div>
  );
};

export default HomePage;
