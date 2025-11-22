import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { TopicCard } from "@/components/TopicCard";
import { useSearch, SearchSort } from "@/hooks/useSearch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { formatRelativeTime } from "@/lib/relativeTime";

const SearchPage = () => {
  const searchContext = useSearch();
  const {
    query,
    setQuery,
    results,
    loading,
    search,
    sort,
    setSort,
    hasMore,
    loadMore,
  } = searchContext;

  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);

  const formatCreatedAt = (dateString: string) =>
    formatRelativeTime(new Date(dateString), getText);

  const params = new URLSearchParams(location.search);
  const initialQuery = params.get('q') || '';

  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
      search(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleSubmit = (term: string) => {
    const sanitized = term.trim();
    if (!sanitized) return;
    navigate(`/search?q=${encodeURIComponent(sanitized)}`, { replace: true });
    search(sanitized);
  };

  const handleSortChange = (value: string) => {
    setSort(value as SearchSort);
  };

  if (uiTextsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-gradient-primary shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
            onClick={() => navigate('/home')}
            aria-label={getText('search.button.backHome', '返回首頁')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary-foreground">
              {getText('search.header.title', '搜尋主題')}
            </h1>
            <p className="text-sm text-primary-foreground/80">
              {getText('search.header.subtitle', '輸入關鍵字或標籤，快速找到討論')}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <SearchBar
          searchContext={searchContext}
          onSubmit={handleSubmit}
          showHistory={false}
        />

        <Tabs value={sort} onValueChange={handleSortChange} className="w-full">
          <TabsList className="grid grid-cols-3 w-full mb-4 bg-muted">
            <TabsTrigger value="relevance">
              {getText('search.tab.relevance', '相關度')}
            </TabsTrigger>
            <TabsTrigger value="hot">
              {getText('search.tab.hot', '熱門')}
            </TabsTrigger>
            <TabsTrigger value="latest">
              {getText('search.tab.latest', '最新')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={sort} className="space-y-4 mt-0">
            {loading && results.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">
                  {query.trim()
                    ? getText('search.empty.withQuery', '找不到符合的主題，換個關鍵字試試？')
                    : getText('search.empty.noQuery', '輸入關鍵字開始搜尋')}
                </p>
              </div>
            ) : (
              <>
                {results.map(topic => (
                  <TopicCard
                    key={topic.id}
                    id={topic.id}
                    title={topic.title}
                    tags={topic.tags}
                    voteCount={topic.total_votes || 0}
                    creatorName={topic.creator_name || getText('common.anonymous', '匿名')}
                    isHot={topic.match_type === 'tag' ? false : topic.total_votes > 1000}
                    createdAt={formatCreatedAt(topic.created_at)}
                    currentExposureLevel={topic.exposure_level || null}
                  />
                ))}

                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={loading}
                    >
                      {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {getText('search.loadMore', '載入更多')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SearchPage;

