import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveBaseLanguage, Language, BaseLanguage } from "@/contexts/LanguageContext";

interface UIText {
  id?: string;
  key: string;
  value: string;
  description?: string;
  category: string;
  zh?: string;
  en?: string;
  ja?: string;
  updated_at?: string;
}

type CachedUIText = {
  version: string | null;
  data: UIText[];
};

const VERSION_QUERY_KEY = 'ui-texts-version';
const DATA_QUERY_KEY = 'ui-texts-data';

const getStorageKeys = (language: BaseLanguage) => ({
  versionKey: `ui_texts_version_${language}`,
  dataKey: `ui_texts_cache_${language}`,
});

const safeGetItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
};

const safeSetItem = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
};

const parseCachedData = (raw: string | null): CachedUIText | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedUIText;
    if (parsed && Array.isArray(parsed.data)) {
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to parse cached UI texts:', error);
  }
  return null;
};

export const useUIText = (language: Language = 'zh') => {
  const baseLanguage = resolveBaseLanguage(language);
  const { versionKey, dataKey } = useMemo(() => getStorageKeys(baseLanguage), [baseLanguage]);
  const [cachedTexts, setCachedTexts] = useState<UIText[] | null>(null);

  // Load cached texts on mount or when language changes
  useEffect(() => {
    const cached = parseCachedData(safeGetItem(dataKey));
    if (cached) {
      setCachedTexts(cached.data);
    } else {
      setCachedTexts(null);
    }
  }, [dataKey]);

  const { data: latestVersion } = useQuery({
    queryKey: [VERSION_QUERY_KEY, baseLanguage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ui_texts')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0]?.updated_at ?? null;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const storedVersion = useMemo(() => safeGetItem(versionKey), [versionKey, latestVersion]);
  const needsRefresh = latestVersion !== null && latestVersion !== storedVersion;

  const shouldFetchTexts = latestVersion === null ? cachedTexts === null : needsRefresh;

  const { data: fetchedTexts, isLoading: textsLoading } = useQuery({
    queryKey: [DATA_QUERY_KEY, baseLanguage, latestVersion],
    enabled: shouldFetchTexts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ui_texts')
        .select('*');

      if (error) throw error;

      const cachePayload: CachedUIText = {
        version: latestVersion,
        data: data ?? [],
      };

      safeSetItem(dataKey, JSON.stringify(cachePayload));
      if (latestVersion) {
        safeSetItem(versionKey, latestVersion);
      }
      setCachedTexts(data ?? []);
      return data ?? [];
    },
  });

  const texts = fetchedTexts ?? cachedTexts ?? [];

  const getText = (textKey: string, fallback: string = '') => {
    if (!texts) return fallback;

    const found = texts.find((t: UIText) => t.key === textKey);
    if (!found) return fallback;

    return found[baseLanguage] || found.value || fallback;
  };

  return { texts, getText, isLoading: textsLoading && !cachedTexts };
};
