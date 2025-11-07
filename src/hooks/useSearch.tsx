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
  options: Array<{
    id: string;
    text: string;
    votes: number;
  }>;
  total_votes: number;
  creator_name?: string;
  creator_avatar?: string;
  match_type?: 'title' | 'tag' | 'description';
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

export const useSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({});

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

  // 執行搜尋
  const search = async (searchQuery?: string) => {
    const q = searchQuery !== undefined ? searchQuery : query;
    
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      // 構建查詢
      let dbQuery = supabase
        .from('topics')
        .select(`
          *,
          profiles:creator_id (
            nickname,
            avatar
          )
        `)
        .eq('status', 'active')
        .eq('is_hidden', false)  // 只顯示未隱藏的主題
        .gte('end_at', new Date().toISOString());

      // 搜尋關鍵字（標題或標籤）
      const searchTerm = q.trim().toLowerCase();

      // 使用 PostgreSQL 的文字搜尋（如果支援）或簡單的 LIKE 查詢
      // 這裡我們先用前端篩選，因為 Supabase 的 textSearch 需要特殊配置
      
      // 應用篩選器
      if (filters.status) {
        dbQuery = dbQuery.eq('status', filters.status);
      }

      if (filters.tags && filters.tags.length > 0) {
        dbQuery = dbQuery.overlaps('tags', filters.tags);
      }

      dbQuery = dbQuery.order('created_at', { ascending: false }).limit(50);

      const { data, error } = await dbQuery;

      if (error) throw error;

      // 前端篩選和排序
      const filtered = (data || []).filter(topic => {
        const titleMatch = topic.title.toLowerCase().includes(searchTerm);
        const tagMatch = topic.tags?.some((tag: string) => 
          tag.toLowerCase().includes(searchTerm)
        );
        const descMatch = topic.description?.toLowerCase().includes(searchTerm);

        return titleMatch || tagMatch || descMatch;
      });

      // 處理結果並添加匹配類型
      const processedResults: SearchResult[] = filtered.map(topic => {
        const totalVotes = topic.options?.reduce(
          (sum: number, opt: any) => sum + (opt.votes || 0), 
          0
        ) || 0;

        // 判斷匹配類型
        let matchType: 'title' | 'tag' | 'description' = 'title';
        if (topic.title.toLowerCase().includes(searchTerm)) {
          matchType = 'title';
        } else if (topic.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm))) {
          matchType = 'tag';
        } else {
          matchType = 'description';
        }

        return {
          ...topic,
          creator_name: topic.profiles?.nickname || '匿名用戶',
          creator_avatar: topic.profiles?.avatar || '👤',
          total_votes: totalVotes,
          match_type: matchType,
        };
      });

      // 按相關性排序（標題匹配 > 標籤匹配 > 描述匹配）
      processedResults.sort((a, b) => {
        const matchOrder = { title: 0, tag: 1, description: 2 };
        return matchOrder[a.match_type!] - matchOrder[b.match_type!];
      });

      setResults(processedResults);

      // 保存搜尋歷史
      if (q.trim()) {
        addToSearchHistory(q.trim());
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error('搜尋失敗');
      setResults([]);
    } finally {
      setLoading(false);
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
  };

  // 應用篩選器
  const applyFilters = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    if (query.trim()) {
      search(query);
    }
  };

  return {
    query,
    setQuery,
    results,
    loading,
    search,
    clearResults,
    searchHistory,
    clearSearchHistory,
    removeFromHistory,
    filters,
    applyFilters,
  };
};

