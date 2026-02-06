import { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopicCard } from "@/components/TopicCard";
import { Button } from "@/components/ui/button";
import { PlusCircle, Activity, Loader2 } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AnnouncementCarousel } from "@/components/AnnouncementCarousel";
import { SearchBar } from "@/components/SearchBar";
import { Logo } from "@/components/Logo";
import { useTopics } from "@/hooks/useTopics";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { formatRelativeTime } from "@/lib/relativeTime";
import { insertAdsIntoList } from "@/lib/adInsertion";

/** 首頁各分頁一次下拉／初次載入時取得的卡片數量（熱門、最新、參與過皆為此數量） */
const TOPICS_PAGE_SIZE = 20;

const HomePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);
  const { getConfig, loading: configLoading, configs } = useSystemConfigCache();
  const [currentTab, setCurrentTab] = useState<'hot' | 'latest' | 'joined'>('hot');
  
  // 當從其他頁面回到首頁時，確保 Intersection Observer 重新設置
  useEffect(() => {
    // 當 location.pathname 變為 /home 時，表示回到了首頁
    // 這會觸發 Intersection Observer 的重新設置
  }, [location.pathname]);
  
  // 注意：配置緩存會在首次加載時自動獲取，不需要每次掛載都刷新
  // 如果需要強制刷新配置，可以在特定場景下手動調用 refreshConfigs()
  
  // 根據當前標籤獲取主題（啟用無限滾動）
  const { 
    topics: hotTopics, 
    loading: hotLoading, 
    loadingMore: hotLoadingMore,
    hasMore: hotHasMore,
    loadMore: hotLoadMore 
  } = useTopics({ 
    filter: 'hot', 
    limit: TOPICS_PAGE_SIZE,
    enableInfiniteScroll: true
  });
  const { 
    topics: latestTopics, 
    loading: latestLoading,
    loadingMore: latestLoadingMore,
    hasMore: latestHasMore,
    loadMore: latestLoadMore
  } = useTopics({ 
    filter: 'latest', 
    limit: TOPICS_PAGE_SIZE,
    enableInfiniteScroll: true
  });
  const { 
    topics: joinedTopics, 
    loading: joinedLoading,
    loadingMore: joinedLoadingMore,
    hasMore: joinedHasMore,
    loadMore: joinedLoadMore
  } = useTopics({ 
    filter: 'joined', 
    userId: user?.id,
    limit: TOPICS_PAGE_SIZE,
    enableInfiniteScroll: true
  });

  /** 當前分頁是否正在初次載入（載入完成前阻擋操作） */
  const isCurrentTabLoading =
    (currentTab === 'hot' && hotLoading) ||
    (currentTab === 'latest' && latestLoading) ||
    (currentTab === 'joined' && joinedLoading);

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

  // 廣告配置（從系統配置讀取，完全由後台控制）
  const adInsertionIntervalRaw = getConfig('ad_insertion_interval', 10);
  const adInsertionInterval = Number(adInsertionIntervalRaw) || 10;
  
  const adInsertionSkipFirstRaw = getConfig('ad_insertion_skip_first', 10);
  const adInsertionSkipFirst = Number(adInsertionSkipFirstRaw) || 10;
  
  const adUnitIdConfig = getConfig('admob_native_ad_unit_id', 'ca-app-pub-3940256099942544/2247696110');
  const adUnitId = typeof adUnitIdConfig === 'string' ? adUnitIdConfig : String(adUnitIdConfig || '');
  
  const adInsertionEnabledValue = getConfig('ad_insertion_enabled', true);
  const adInsertionEnabled = adInsertionEnabledValue === true || adInsertionEnabledValue === 'true' || String(adInsertionEnabledValue).toLowerCase() === 'true';
  
  // 調試：輸出實際讀取到的配置值
  useEffect(() => {
    console.log('[HomePage] 讀取的配置值:');
    console.log('  - ad_insertion_interval (原始):', adInsertionIntervalRaw, '→ (解析後):', adInsertionInterval);
    console.log('  - ad_insertion_skip_first (原始):', adInsertionSkipFirstRaw, '→ (解析後):', adInsertionSkipFirst);
    console.log('  - ad_insertion_enabled (原始):', adInsertionEnabledValue, '→ (解析後):', adInsertionEnabled);
    console.log('  - admob_native_ad_unit_id:', adUnitIdConfig ? 'SET' : 'MISSING');
  }, [adInsertionIntervalRaw, adInsertionSkipFirstRaw, adInsertionEnabledValue, adUnitIdConfig, adInsertionInterval, adInsertionSkipFirst, adInsertionEnabled]);
  
  const adConfig = {
    interval: adInsertionInterval,
    skipFirst: adInsertionSkipFirst,
    adUnitId: adUnitId,
    enabled: adInsertionEnabled,
  };

  const hotTabSkipFirst = shouldShowPromotedSection
    ? Math.max(0, adConfig.skipFirst - promotedHotTopics.length)
    : adConfig.skipFirst;

  // 調試信息（只在配置變化時輸出，避免重複日誌）
  useEffect(() => {
    const configKey = `${adInsertionEnabled}-${adInsertionInterval}-${adInsertionSkipFirst}-${adUnitId ? 'SET' : 'MISSING'}`;
    if (!(window as any).__homePageAdConfigLogged || (window as any).__homePageAdConfigLogged !== configKey) {
      console.log(`[HomePage] 廣告配置: enabled=${adInsertionEnabled}, interval=${adInsertionInterval}, skipFirst=${adInsertionSkipFirst}, adUnitId=${adUnitId ? 'SET' : 'MISSING'}`);
      (window as any).__homePageAdConfigLogged = configKey;
    }
  }, [adInsertionEnabled, adInsertionInterval, adInsertionSkipFirst, adUnitId]);

  const userTokens = profile?.tokens || 0;

  // 無限滾動：Intersection Observer refs
  const hotLoadMoreRef = useRef<HTMLDivElement>(null);
  const latestLoadMoreRef = useRef<HTMLDivElement>(null);
  const joinedLoadMoreRef = useRef<HTMLDivElement>(null);

  // 無限滾動：載入更多處理
  const handleHotLoadMore = useCallback(() => {
    if (hotHasMore && !hotLoadingMore && !hotLoading) {
      hotLoadMore();
    }
  }, [hotHasMore, hotLoadingMore, hotLoading, hotLoadMore]);

  const handleLatestLoadMore = useCallback(() => {
    if (latestHasMore && !latestLoadingMore && !latestLoading) {
      latestLoadMore();
    }
  }, [latestHasMore, latestLoadingMore, latestLoading, latestLoadMore]);

  const handleJoinedLoadMore = useCallback(() => {
    if (joinedHasMore && !joinedLoadingMore && !joinedLoading) {
      joinedLoadMore();
    }
  }, [joinedHasMore, joinedLoadingMore, joinedLoading, joinedLoadMore]);

  // 無限滾動：設置 Intersection Observer
  // 只在當前標籤頁顯示時才設置 Observer，確保從其他頁面回來時能正常工作
  // 添加 location.pathname 作為依賴，確保從其他頁面回來時重新設置
  useEffect(() => {
    // 只在熱門標籤頁顯示時設置 Observer
    if (currentTab !== 'hot') return;

    let observer: IntersectionObserver | null = null;
    let timer: NodeJS.Timeout | null = null;

    // 使用 setTimeout 確保 DOM 已更新
    timer = setTimeout(() => {
      const element = hotLoadMoreRef.current;
      if (!element || !hotHasMore) return;

      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hotHasMore && !hotLoadingMore && !hotLoading) {
            handleHotLoadMore();
          }
        },
        { threshold: 0.1, rootMargin: '100px' }
      );

      observer.observe(element);
    }, 100);

    return () => {
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [currentTab, location.pathname, hotHasMore, hotLoadingMore, hotLoading, handleHotLoadMore]);

  useEffect(() => {
    // 只在最新標籤頁顯示時設置 Observer
    if (currentTab !== 'latest') return;

    let observer: IntersectionObserver | null = null;
    let timer: NodeJS.Timeout | null = null;

    // 使用 setTimeout 確保 DOM 已更新
    timer = setTimeout(() => {
      const element = latestLoadMoreRef.current;
      if (!element || !latestHasMore) return;

      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && latestHasMore && !latestLoadingMore && !latestLoading) {
            handleLatestLoadMore();
          }
        },
        { threshold: 0.1, rootMargin: '100px' }
      );

      observer.observe(element);
    }, 100);

    return () => {
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [currentTab, location.pathname, latestHasMore, latestLoadingMore, latestLoading, handleLatestLoadMore]);

  useEffect(() => {
    // 只在參與過標籤頁顯示時設置 Observer
    if (currentTab !== 'joined') return;

    let observer: IntersectionObserver | null = null;
    let timer: NodeJS.Timeout | null = null;

    // 使用 setTimeout 確保 DOM 已更新
    timer = setTimeout(() => {
      const element = joinedLoadMoreRef.current;
      if (!element || !joinedHasMore) return;

      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && joinedHasMore && !joinedLoadingMore && !joinedLoading) {
            handleJoinedLoadMore();
          }
        },
        { threshold: 0.1, rootMargin: '100px' }
      );

      observer.observe(element);
    }, 100);

    return () => {
      if (timer) clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [currentTab, location.pathname, joinedHasMore, joinedLoadingMore, joinedLoading, handleJoinedLoadMore]);

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

  // 底部工具列高度 + 安全區域，供列表最下方空白區塊使用，避免最後一張卡片被遮住
  const bottomSpacerClass = "min-h-[calc(5rem+env(safe-area-inset-bottom,0px))]";

  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* Header：預留頂部空間給狀態列與鏡頭（劉海/挖孔） */}
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="md" />
              <div>
                <h1 className="text-2xl font-bold text-primary-foreground">
                  {getText('home.header.title', 'ChaosRegistry')}
                </h1>
                <p className="text-sm text-primary-foreground/80">
                  {getText('home.header.subtitle', '不理性登記處')}
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => navigate('/recharge')}
              className="flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-primary-foreground/30 transition-colors cursor-pointer"
            >
              <Activity className="w-5 h-5 text-accent" />
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

        <div className="relative min-h-[12rem]">
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

            {/* 初次載入時覆蓋整個分頁區，阻擋操作直到載入完成 */}
            {isCurrentTabLoading && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/90 min-h-[12rem]"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {getText('common.state.loading', '載入中...')}
                </span>
              </div>
            )}

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
                            currentExposureLevel={topic.current_exposure_level ?? topic.exposure_level ?? null}
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
                            currentExposureLevel={topic.current_exposure_level ?? topic.exposure_level ?? null}
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
                {/* 無限滾動觸發元素 */}
                {hotHasMore && (
                  <div ref={hotLoadMoreRef} className="py-4">
                    {hotLoadingMore && (
                      <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">{getText('common.state.loading', '載入中...')}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* 拉到底、沒有更多時顯示提示 */}
                {!hotHasMore && hotTopics.length > 0 && (
                  <div className="py-4 text-center">
                    <span className="text-sm text-muted-foreground">
                      {getText('home.list.noMore', '已經到底了')}
                    </span>
                  </div>
                )}
                {/* 最下方空白區塊，避免最後一張卡片被底部工具列遮住 */}
                <div className={bottomSpacerClass} aria-hidden="true" />
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
                        currentExposureLevel={topic.current_exposure_level ?? topic.exposure_level ?? null}
                      />
                    </div>
                  ),
                  { ...adConfig, adIndex: 100 }
                )}
                {/* 無限滾動觸發元素 */}
                {latestHasMore && (
                  <div ref={latestLoadMoreRef} className="py-4">
                    {latestLoadingMore && (
                      <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">{getText('common.state.loading', '載入中...')}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* 拉到底、沒有更多時顯示提示 */}
                {!latestHasMore && latestTopics.length > 0 && (
                  <div className="py-4 text-center">
                    <span className="text-sm text-muted-foreground">
                      {getText('home.list.noMore', '已經到底了')}
                    </span>
                  </div>
                )}
                {/* 最下方空白區塊，避免最後一張卡片被底部工具列遮住 */}
                <div className={bottomSpacerClass} aria-hidden="true" />
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
                        currentExposureLevel={topic.current_exposure_level ?? topic.exposure_level ?? null}
                      />
                    </div>
                  ),
                  { ...adConfig, adIndex: 200 }
                )}
                {/* 無限滾動觸發元素 */}
                {joinedHasMore && (
                  <div ref={joinedLoadMoreRef} className="py-4">
                    {joinedLoadingMore && (
                      <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">{getText('common.state.loading', '載入中...')}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* 拉到底、沒有更多時顯示提示 */}
                {!joinedHasMore && joinedTopics.length > 0 && (
                  <div className="py-4 text-center">
                    <span className="text-sm text-muted-foreground">
                      {getText('home.list.noMore', '已經到底了')}
                    </span>
                  </div>
                )}
                {/* 最下方空白區塊，避免最後一張卡片被底部工具列遮住 */}
                <div className={bottomSpacerClass} aria-hidden="true" />
              </div>
            )}
          </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* Floating Action Button：高於底部工具列，避免被遮住 */}
      <Link to="/create">
        <Button
          variant="accent"
          size="lg"
          className="fixed right-6 rounded-full w-14 h-14 shadow-glow bottom-[calc(5rem+env(safe-area-inset-bottom))]"
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
