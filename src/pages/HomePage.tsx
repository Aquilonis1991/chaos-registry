import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopicCard } from "@/components/TopicCard";
import { Button } from "@/components/ui/button";
import { PlusCircle, Coins, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AnnouncementCarousel } from "@/components/AnnouncementCarousel";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import { SearchFilters } from "@/components/SearchFilters";
import { useTopics } from "@/hooks/useTopics";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useSearch } from "@/hooks/useSearch";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { AdBanner } from "@/components/AdBanner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);
  const [currentTab, setCurrentTab] = useState<'hot' | 'latest' | 'joined' | 'search'>('hot');
  const { results: searchResults, loading: searchLoading, query, applyFilters } = useSearch();
  
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

  const userTokens = profile?.tokens || 0;

  // 當有搜尋結果時自動切換到搜尋分頁
  const handleSearchResults = (results: any[]) => {
    if (results.length > 0 || query) {
      setCurrentTab('search');
    }
  };

  if (uiTextsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary-foreground">
                {getText('home.header.title', 'VoteChaos')}
              </h1>
              <p className="text-sm text-primary-foreground/80">
                {getText('home.header.subtitle', '投票混亂製造機')}
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
        <div className="mb-6 flex gap-2">
          <div className="flex-1">
            <SearchBar 
              onSearchResults={handleSearchResults}
              showHistory={true}
            />
          </div>
          <SearchFilters 
            onApplyFilters={applyFilters}
          />
        </div>

        {/* AdMob Banner 廣告 */}
        <AdBanner 
          className="mb-6"
          placeholderText={getText('home.banner.placeholder', '首頁 Banner 廣告')}
        />

        <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as any)} className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-6 bg-muted h-12">
            <TabsTrigger value="hot" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {getText('home.tab.hot', '🔥 熱門')}
            </TabsTrigger>
            <TabsTrigger value="latest" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {getText('home.tab.latest', '⚡ 最新')}
            </TabsTrigger>
            <TabsTrigger value="joined" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {getText('home.tab.joined', '✅ 參與過')}
            </TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {getText('home.tab.search', '🔍 搜尋')}
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
              hotTopics.map((topic, index) => (
                <div key={topic.id}>
                  <TopicCard 
                    id={topic.id}
                    title={topic.title}
                    tags={topic.tags}
                    voteCount={topic.total_votes || 0}
                    creatorName={topic.creator_name || getText('common.anonymous', '匿名')}
                    isHot={topic.is_hot}
                    createdAt={formatDistanceToNow(new Date(topic.created_at), { 
                      addSuffix: true, 
                      locale: zhTW 
                    })}
                  />
                  {/* AdMob Section - Between Topics */}
                  {index === 1 && (
                    <div className="bg-muted/50 border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center mt-4">
                      <p className="text-muted-foreground text-sm">
                        {getText('home.ad.native.placeholder', '📱 AdMob 中間廣告')}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {getText('home.ad.native.size', 'Native Ad / Medium Rectangle (300x250)')}
                      </p>
                    </div>
                  )}
                </div>
              ))
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
              latestTopics.map((topic, index) => (
                <div key={topic.id}>
                  <TopicCard 
                    id={topic.id}
                    title={topic.title}
                    tags={topic.tags}
                    voteCount={topic.total_votes || 0}
                    creatorName={topic.creator_name || getText('common.anonymous', '匿名')}
                    isHot={topic.is_hot}
                    createdAt={formatDistanceToNow(new Date(topic.created_at), { 
                      addSuffix: true, 
                      locale: zhTW 
                    })}
                  />
                  {/* AdMob Section - Between Topics */}
                  {index === 2 && (
                    <div className="bg-muted/50 border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center mt-4">
                      <p className="text-muted-foreground text-sm">
                        {getText('home.ad.native.placeholder', '📱 AdMob 中間廣告')}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {getText('home.ad.native.size', 'Native Ad / Medium Rectangle (300x250)')}
                      </p>
                    </div>
                  )}
                </div>
              ))
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
              joinedTopics.map((topic) => (
                <div key={topic.id}>
                  <TopicCard 
                    id={topic.id}
                    title={topic.title}
                    tags={topic.tags}
                    voteCount={topic.total_votes || 0}
                    creatorName={topic.creator_name || getText('common.anonymous', '匿名')}
                    isHot={topic.is_hot}
                    createdAt={formatDistanceToNow(new Date(topic.created_at), { 
                      addSuffix: true, 
                      locale: zhTW 
                    })}
                  />
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="search" className="space-y-4 mt-0">
            <SearchResults 
              results={searchResults}
              query={query}
              loading={searchLoading}
            />
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
