import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  creator_id: string;
  created_at: string;
  end_at: string;
  status: string;
  options?: Array<{
    id: string;
    text: string;
    votes: number;
  }>;
  total_votes: number;
  creator_name?: string;
  creator_avatar?: string;
  match_type?: 'title' | 'tag' | 'description';
  exposure_level?: 'normal' | 'medium' | 'high' | null;
}

interface SearchFilters {
  tags?: string[];
  status?: string;
  minVotes?: number;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

export type SearchSort = 'relevance' | 'hot' | 'latest';

export interface SearchSuggestion {
  suggestion_type: 'topic' | 'tag';
  suggestion_text: string;
  topic_id?: string | null;
}

const PAGE_SIZE = 20;

export const useSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sort, setSort] = useState<SearchSort>('relevance');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [lastQuery, setLastQuery] = useState("");

  // 載入搜尋歷史
  useEffect(() => {
    const history = localStorage.getItem('search_history');
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    }
  }, []);

  const fetchResults = async (
    searchQuery: string,
    pageIndex = 0,
    options?: { append?: boolean; skipHistory?: boolean }
  ) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasMore(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('search_topics', {
        p_query: searchQuery,
        p_limit: PAGE_SIZE,
        p_offset: pageIndex * PAGE_SIZE,
        p_sort: sort,
      });

      if (error) throw error;

      const filteredData = (data || []).filter(topic => {
        if (filters.status && topic.status !== filters.status) return false;
        if (filters.tags && filters.tags.length > 0) {
          const topicTags = topic.tags || [];
          const hasTag = filters.tags.some(tag =>
            topicTags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
          );
          if (!hasTag) return false;
        }
        if (filters.minVotes && (topic.total_votes || 0) < filters.minVotes) return false;
        if (filters.dateRange?.start && new Date(topic.created_at) < filters.dateRange.start) {
          return false;
        }
        if (filters.dateRange?.end && new Date(topic.created_at) > filters.dateRange.end) {
          return false;
        }
        return true;
      });

      const processedResults: SearchResult[] = filteredData.map(topic => ({
        ...topic,
        creator_name: topic.creator_name || '匿名用戶',
        creator_avatar: topic.creator_avatar || '👤',
        total_votes: topic.total_votes || 0,
        match_type: (topic.match_type as 'title' | 'tag' | 'description') ?? 'title',
      }));

      setResults(prev =>
        options?.append ? [...prev, ...processedResults] : processedResults
      );
      setHasMore((filteredData || []).length === PAGE_SIZE);
      setPage(pageIndex);
      setLastQuery(searchQuery);

      if (!options?.skipHistory) {
        addToSearchHistory(searchQuery);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error('搜尋失敗');
      if (!options?.append) {
        setResults([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // 執行搜尋
  const search = async (searchQuery?: string, options?: { skipHistory?: boolean }) => {
    const q = searchQuery !== undefined ? searchQuery : query;
    
    if (!q.trim()) {
      setResults([]);
      setHasMore(false);
      return;
    }

    await fetchResults(q.trim(), 0, { append: false, skipHistory: options?.skipHistory });
  };

  const loadMore = async () => {
    if (!hasMore || loading || !lastQuery.trim()) return;
    await fetchResults(lastQuery, page + 1, { append: true, skipHistory: true });
  };

  // 排序變更時重新搜尋
  useEffect(() => {
    if (lastQuery.trim()) {
      search(lastQuery, { skipHistory: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const fetchSuggestions = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('search_topic_suggestions', {
        p_query: trimmed,
        p_limit: 10,
      });

      if (error) throw error;

      setSuggestions(
        (data || []).map(item => ({
          suggestion_type: (item.suggestion_type as 'topic' | 'tag') ?? 'topic',
          suggestion_text: item.suggestion_text || '',
          topic_id: item.topic_id,
        })).filter(item => item.suggestion_text)
      );
    } catch (error) {
      console.error('Suggestion error:', error);
    }
  };

  // 添加到搜尋歷史
  const addToSearchHistory = (searchTerm: string) => {
    const newHistory = [
      searchTerm,
      ...searchHistory.filter(h => h !== searchTerm)
    ].slice(0, 10); // 只保留最近 10 條

    setSearchHistory(newHistory);
    localStorage.setItem('search_history', JSON.stringify(newHistory));
  };

  // 清除搜尋歷史
  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('search_history');
  };

  // 刪除單條歷史
  const removeFromHistory = (searchTerm: string) => {
    const newHistory = searchHistory.filter(h => h !== searchTerm);
    setSearchHistory(newHistory);
    localStorage.setItem('search_history', JSON.stringify(newHistory));
  };

  // 清除搜尋結果
  const clearResults = () => {
    setQuery("");
    setResults([]);
    setHasMore(false);
  };

  // 應用篩選器
  const applyFilters = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    if (query.trim()) {
      search(query, { skipHistory: true });
    }
  };

  return {
    query,
    setQuery,
    results,
    loading,
    sort,
    setSort,
    hasMore,
    loadMore,
    search,
    clearResults,
    searchHistory,
    clearSearchHistory,
    removeFromHistory,
    filters,
    applyFilters,
    suggestions,
    fetchSuggestions,
  };
};

