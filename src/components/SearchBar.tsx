import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, 
  X, 
  Clock, 
  TrendingUp,
  Filter,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch, SearchSuggestion } from "@/hooks/useSearch";
import { useDebouncedCallback } from "use-debounce";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

interface SearchBarProps {
  onSearchResults?: (results: any[]) => void;
  placeholder?: string;
  showHistory?: boolean;
  showFilters?: boolean;
  className?: string;
  onSubmit?: (term: string) => void;
  searchContext?: ReturnType<typeof useSearch>;
}

export const SearchBar = ({ 
  onSearchResults,
  placeholder,
  showHistory = true,
  showFilters = false,
  className,
  onSubmit,
  searchContext,
}: SearchBarProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const {
    query,
    setQuery,
    results,
    loading,
    search,
    clearResults,
    searchHistory,
    removeFromHistory,
    suggestions,
    fetchSuggestions,
  } = searchContext ?? useSearch();

  const effectivePlaceholder = placeholder ?? getText('home.search.placeholder', '搜尋主題、標籤...');
  const searchButtonText = getText('home.search.button', '搜尋');
  const recentSearchLabel = getText('home.search.history.title', '最近搜尋');
  const trendingTagsLabel = getText('home.search.trending.title', '熱門標籤');
  const hotTagConfigs: Array<[string, string]> = [
    ['home.search.tag.food', '美食'],
    ['home.search.tag.tech', '科技'],
    ['home.search.tag.life', '生活'],
    ['home.search.tag.entertainment', '娛樂'],
    ['home.search.tag.sports', '運動'],
    ['home.search.tag.travel', '旅遊'],
    ['home.search.tag.movie', '電影'],
    ['home.search.tag.music', '音樂'],
    ['home.search.tag.gaming', '遊戲'],
    ['home.search.tag.news', '時事'],
  ];
  const hotTags = hotTagConfigs.map(([key, fallback]) => ({
    key,
    label: getText(key, fallback),
  }));
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 當有搜尋結果時通知父組件
  useEffect(() => {
    if (onSearchResults) {
      onSearchResults(results);
    }
  }, [results, onSearchResults]);

  // 防抖搜尋（500ms 延遲）
  const debouncedSearch = useDebouncedCallback(
    (searchQuery: string) => {
      if (searchQuery.trim()) {
        search(searchQuery, { skipHistory: true });
      }
    },
    500
  );

  const handleSearch = async () => {
    if (query.trim()) {
      await search(query);
      onSubmit?.(query.trim());
      setShowSuggestions(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 當輸入改變時觸發防抖搜尋
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // 只有當輸入長度 >= 2 時才自動搜尋
    if (value.trim().length >= 2) {
      debouncedSearch(value);
      fetchSuggestions(value);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      fetchSuggestions('');
    }
  };

  const handleClear = () => {
    setQuery("");
    clearResults();
    fetchSuggestions('');
    inputRef.current?.focus();
  };

  const handleHistoryClick = (historyItem: string) => {
    setQuery(historyItem);
    search(historyItem);
    onSubmit?.(historyItem);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const text = suggestion.suggestion_text;
    if (!text) return;
    setQuery(text);
    search(text);
    onSubmit?.(text);
    setShowSuggestions(false);
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (searchHistory.length > 0 && !query) {
      setShowSuggestions(true);
    } else if (query.trim().length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // 延遲關閉以允許點擊建議項
    setTimeout(() => setShowSuggestions(false), 200);
  };

  // 熱門標籤（可以從系統配置或統計獲取）
  return (
    <div className={cn("relative", className)}>
      {/* 搜尋輸入框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={effectivePlaceholder}
          value={query}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="pl-10 pr-20 h-11"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 w-7 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="h-7 px-3"
          >
            {searchButtonText}
          </Button>
        </div>
      </div>

      {/* 搜尋建議和歷史 */}
      {showSuggestions && isFocused && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg">
          <CardContent className="p-3">
            {query.trim().length >= 2 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Search className="w-4 h-4" />
                  <span>{getText('home.search.suggestions', '相關結果')}</span>
                </div>
                {suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-1">
                    {getText('home.search.noSuggestions', '找不到相關建議')}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {suggestions.slice(0, 10).map((item, index) => (
                      <button
                        key={`${item.suggestion_type}-${item.topic_id || item.suggestion_text}-${index}`}
                        className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-md text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSuggestionClick(item)}
                      >
                        <div className="flex items-center gap-2">
                          {item.suggestion_type === 'tag' ? (
                            <Badge variant="secondary">#{item.suggestion_text}</Badge>
                          ) : (
                            <Search className="w-3 h-3 text-muted-foreground" />
                          )}
                          <span className="text-sm">
                            {item.suggestion_type === 'tag'
                              ? `#${item.suggestion_text}`
                              : item.suggestion_text}
                          </span>
                        </div>
                        {item.suggestion_type === 'topic' && (
                          <span className="text-xs text-muted-foreground">
                            {getText('home.search.suggestion.topic', '主題')}
                          </span>
                        )}
                        {item.suggestion_type === 'tag' && (
                          <span className="text-xs text-muted-foreground">
                            {getText('home.search.suggestion.tag', '標籤')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* 搜尋歷史 */}
                {showHistory && searchHistory.length > 0 && !query && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{recentSearchLabel}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {searchHistory.slice(0, 5).map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 hover:bg-muted rounded-md cursor-pointer group"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleHistoryClick(item)}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm">{item}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromHistory(item);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 熱門標籤 */}
              <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span>{trendingTagsLabel}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hotTags.map(({ key, label }) => (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleHistoryClick(label)}
                      >
                        #{label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

