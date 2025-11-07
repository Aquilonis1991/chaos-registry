import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Tag, AlignLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { TopicCard } from "./TopicCard";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  total_votes: number;
  creator_name?: string;
  created_at: string;
  match_type?: 'title' | 'tag' | 'description';
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  loading?: boolean;
}

export const SearchResults = ({ results, query, loading }: SearchResultsProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  const loadingText = getText('home.search.loading', '搜尋中...');
  const promptTitle = getText('home.search.prompt.title', '輸入關鍵字開始搜尋');
  const promptDescription = getText('home.search.prompt.description', '搜尋主題標題、標籤或內容');
  const noResultsTitle = getText('home.search.noResults.title', '找不到相關主題');
  const noResultsDescription = getText('home.search.noResults.description', '試試其他關鍵字或瀏覽');
  const noResultsLinkText = getText('home.search.noResults.link', '所有主題');
  const suggestionChange = getText('home.search.noResults.suggestion.changeKeyword', '換個關鍵字');
  const suggestionCheck = getText('home.search.noResults.suggestion.checkSpelling', '檢查拼寫');
  const suggestionGeneral = getText('home.search.noResults.suggestion.generalTerm', '使用更通用的詞');
  const summaryTemplate = getText('home.search.summary', '找到 {{count}} 個主題');
  const summaryWithQueryTemplate = getText('home.search.summaryWithQuery', '找到 {{count}} 個主題，包含 "{{query}}"');
  const matchLabels = {
    title: getText('home.search.match.title', '標題匹配'),
    tag: getText('home.search.match.tag', '標籤匹配'),
    description: getText('home.search.match.description', '內容匹配'),
    default: getText('home.search.match.default', '匹配'),
  } as const;
  const anonymousLabel = getText('common.anonymous', '匿名');

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground text-lg mb-2">{promptTitle}</p>
          <p className="text-sm text-muted-foreground">
            {promptDescription}
          </p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center">
            <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-semibold mb-2">{noResultsTitle}</p>
            <p className="text-muted-foreground mb-4">
              {noResultsDescription}
              {' '}
              <Link to="/home" className="text-primary hover:underline">{noResultsLinkText}</Link>
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="outline">{suggestionChange}</Badge>
              <Badge variant="outline">{suggestionCheck}</Badge>
              <Badge variant="outline">{suggestionGeneral}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getMatchIcon = (matchType?: string) => {
    switch (matchType) {
      case 'title':
        return <FileText className="w-3 h-3" />;
      case 'tag':
        return <Tag className="w-3 h-3" />;
      case 'description':
        return <AlignLeft className="w-3 h-3" />;
      default:
        return <Search className="w-3 h-3" />;
    }
  };

  const getMatchLabel = (matchType?: string) => {
    switch (matchType) {
      case 'title':
        return matchLabels.title;
      case 'tag':
        return matchLabels.tag;
      case 'description':
        return matchLabels.description;
      default:
        return matchLabels.default;
    }
  };

  const summaryText = query
    ? summaryWithQueryTemplate
        .replace('{{count}}', results.length.toString())
        .replace('{{query}}', query)
    : summaryTemplate.replace('{{count}}', results.length.toString());

  return (
    <div className="space-y-4">
      {/* 搜尋結果摘要 */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {summaryText}
        </p>
      </div>

      {/* 搜尋結果列表 */}
      <div className="space-y-3">
        {results.map((topic) => (
          <div key={topic.id} className="relative">
            <TopicCard
              id={topic.id}
              title={topic.title}
              tags={topic.tags}
              voteCount={topic.total_votes}
              creatorName={topic.creator_name || anonymousLabel}
              createdAt={formatDistanceToNow(new Date(topic.created_at), { 
                addSuffix: true, 
                locale: zhTW 
              })}
            />
            {/* 匹配類型標記 */}
            {topic.match_type && (
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  {getMatchIcon(topic.match_type)}
                  {getMatchLabel(topic.match_type)}
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

