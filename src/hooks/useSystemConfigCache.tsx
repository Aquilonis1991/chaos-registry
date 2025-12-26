import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global cache for system configs
let configCache: Record<string, any> | null = null;
let cachePromise: Promise<Record<string, any>> | null = null;

const fetchSystemConfig = async (): Promise<Record<string, any>> => {
  try {
    // 改為直接從資料庫讀取，與 Admin 後台邏輯保持一致
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true });

    if (error) throw error;

    // Convert to map
    const configMap = (data || []).reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, any>);

    console.log('[SystemConfig] Fetched from DB:', {
      count: Object.keys(configMap).length,
      keys: Object.keys(configMap),
      dailyDiscount: configMap.daily_topic_discount_tokens
    });

    return configMap;
  } catch (error) {
    console.error('Error fetching system config:', error);
    return {};
  }
};

export const useSystemConfigCache = () => {
  const [configs, setConfigs] = useState<Record<string, any>>(configCache || {});
  const [loading, setLoading] = useState(!configCache);

  useEffect(() => {
    const loadConfigs = async () => {
      // If already cached, use it
      if (configCache) {
        setConfigs(configCache);
        setLoading(false);
        return;
      }

      // If fetch in progress, wait for it
      if (cachePromise) {
        const result = await cachePromise;
        configCache = result;
        setConfigs(result);
        setLoading(false);
        return;
      }

      // Start new fetch
      setLoading(true);
      cachePromise = fetchSystemConfig();
      const result = await cachePromise;
      configCache = result;
      cachePromise = null;
      setConfigs(result);
      setLoading(false);
    };

    loadConfigs();
  }, []);

  const refreshConfigs = useCallback(async () => {
    configCache = null;
    cachePromise = fetchSystemConfig();
    const result = await cachePromise;
    configCache = result;
    cachePromise = null;
    setConfigs(result);
  }, []);

  const getConfig = <T,>(key: string, defaultValue: T): T => {
    // 優先從全局緩存讀取（同步更新），如果沒有則從 state 讀取
    let value: any;
    if (configCache && configCache[key] !== undefined) {
      value = configCache[key];
    } else if (configs[key] !== undefined) {
      value = configs[key];
    } else {
      // 只在關鍵配置缺失時輸出日誌（減少日誌輸出）
      // 注意：ad_reward_amount 是備選配置，如果 mission_watch_ad_reward 存在，這個警告是正常的
      if (key === 'mission_watch_ad_reward' || key === 'mission_watch_ad_limit') {
        console.warn(`[getConfig] 配置 ${key} 不存在，使用默認值:`, defaultValue);
      }
      // ad_reward_amount 和 max_ads_per_day 是備選配置，不需要警告
      return defaultValue;
    }

    // 處理 JSONB 格式：如果值是對象且有 value 屬性，提取它
    if (value && typeof value === 'object' && 'value' in value) {
      value = value.value;
    }

    // 處理字符串數字：如果是字符串形式的數字，轉換為數字
    if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
      const numValue = Number(value);
      return numValue as T;
    }

    // 處理布爾值字符串
    if (typeof value === 'string' && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
      const boolValue = value.toLowerCase() === 'true';
      return boolValue as T;
    }

    return value as T;
  };

  return { configs, loading, getConfig, refreshConfigs };
};

// Function to invalidate cache (call this after updating configs)
export const invalidateConfigCache = () => {
  configCache = null;
};
