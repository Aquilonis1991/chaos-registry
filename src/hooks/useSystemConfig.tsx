import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SystemConfig {
  id: string;
  key: string;
  value: any;
  category: string;
  description?: string;
  updated_at: string;
}

export const useSystemConfig = () => {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('*')
        .order('category', { ascending: true })
        .order('key', { ascending: true });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Error fetching system config:', error);
      toast.error('載入系統配置失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const updateConfig = async (id: string, newValue: any) => {
    try {
      const { error } = await supabase
        .from('system_config')
        .update({ value: newValue })
        .eq('id', id);

      if (error) throw error;

      setConfigs(prev => prev.map(config => 
        config.id === id ? { ...config, value: newValue } : config
      ));

      toast.success('配置已更新');
      return true;
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('更新配置失敗');
      return false;
    }
  };

  const getConfigValue = (key: string): any => {
    const config = configs.find(c => c.key === key);
    return config?.value;
  };

  return { configs, loading, updateConfig, fetchConfigs, getConfigValue };
};
