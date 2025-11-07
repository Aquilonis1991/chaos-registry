import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global cache for system configs
let configCache: Record<string, any> | null = null;
let cachePromise: Promise<Record<string, any>> | null = null;

const fetchSystemConfig = async (): Promise<Record<string, any>> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-system-config');
    
    if (error) throw error;
    return data.configs;
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

  const refreshConfigs = async () => {
    configCache = null;
    cachePromise = fetchSystemConfig();
    const result = await cachePromise;
    configCache = result;
    cachePromise = null;
    setConfigs(result);
  };

  const getConfig = <T,>(key: string, defaultValue: T): T => {
    return configs[key] !== undefined ? configs[key] : defaultValue;
  };

  return { configs, loading, getConfig, refreshConfigs };
};

// Function to invalidate cache (call this after updating configs)
export const invalidateConfigCache = () => {
  configCache = null;
};
