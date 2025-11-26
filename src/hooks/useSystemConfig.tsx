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
      // 找到要更新的配置項
      const config = configs.find(c => c.id === id);
      if (!config) {
        throw new Error('找不到要更新的配置項');
      }

      // 確保值被正確轉換為 JSONB 格式
      // 對於 number 和 boolean，需要明確轉換
      let jsonbValue: any;
      const valueType = typeof newValue;
      
      if (valueType === 'number') {
        jsonbValue = newValue; // Supabase 會自動轉換為 JSONB
      } else if (valueType === 'boolean') {
        jsonbValue = newValue; // Supabase 會自動轉換為 JSONB
      } else if (valueType === 'string') {
        // 嘗試解析為 JSON，如果失敗則保持為字符串
        try {
          jsonbValue = JSON.parse(newValue);
        } catch {
          jsonbValue = newValue;
        }
      } else if (valueType === 'object' && newValue !== null) {
        jsonbValue = newValue; // 對象直接傳遞
      } else {
        jsonbValue = newValue;
      }

      console.log('[useSystemConfig] 更新配置:', {
        id,
        key: config.key,
        原始值: config.value,
        新值: newValue,
        轉換後: jsonbValue,
        類型: typeof jsonbValue
      });

      // 首先嘗試使用 RPC 函數更新（更可靠）
      let data: any[] | null = null;
      let error: any = null;

      try {
        const rpcResult = await supabase.rpc('update_system_config', {
          p_config_id: id,
          p_new_value: jsonbValue
        });

        if (rpcResult.error) {
          console.warn('[useSystemConfig] RPC 函數失敗，嘗試直接更新:', rpcResult.error);
          error = rpcResult.error;
        } else if (rpcResult.data && rpcResult.data.length > 0) {
          // RPC 成功
          data = rpcResult.data;
          console.log('[useSystemConfig] RPC 更新成功');
        }
      } catch (rpcError) {
        console.warn('[useSystemConfig] RPC 函數不存在或失敗，嘗試直接更新:', rpcError);
      }

      // 如果 RPC 失敗，使用標準更新
      if (!data || data.length === 0) {
        console.log('[useSystemConfig] 使用標準 UPDATE 方法');
        const updateResult = await supabase
          .from('system_config')
          .update({ 
            value: jsonbValue
          })
          .eq('id', id)
          .select();

        if (updateResult.error) {
          error = updateResult.error;
          console.error('[useSystemConfig] Supabase update error:', error);
          console.error('[useSystemConfig] Error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
        } else {
          data = updateResult.data;
        }
      }

      if (error) {
        throw error;
      }

      // 驗證更新是否成功
      if (!data || data.length === 0) {
        console.error('[useSystemConfig] No data returned from update');
        // 重新獲取以確認
        const { data: checkData, error: checkError } = await supabase
          .from('system_config')
          .select('*')
          .eq('id', id)
          .single();
        
        if (checkError) {
          throw new Error(`更新失敗：無法驗證更新結果 (${checkError.message})`);
        }
        
        console.log('[useSystemConfig] 驗證資料庫中的值:', {
          預期值: jsonbValue,
          實際值: checkData.value,
          是否相同: JSON.stringify(checkData.value) === JSON.stringify(jsonbValue)
        });
        
        if (checkData && JSON.stringify(checkData.value) !== JSON.stringify(jsonbValue)) {
          throw new Error(`更新失敗：資料庫中的值未改變。預期: ${JSON.stringify(jsonbValue)}, 實際: ${JSON.stringify(checkData.value)}`);
        }
      }

      // 更新本地狀態
      if (data && data.length > 0) {
        const updatedConfig = data[0];
        console.log('[useSystemConfig] 更新成功，新值:', updatedConfig.value);
        setConfigs(prev => prev.map(config => 
          config.id === id ? { ...config, value: updatedConfig.value, updated_at: updatedConfig.updated_at } : config
        ));
      }

      // 重新獲取配置以確保同步
      await fetchConfigs();

      toast.success('配置已更新');
      return true;
    } catch (error) {
      console.error('[useSystemConfig] Error updating config:', error);
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      toast.error(`更新配置失敗: ${errorMessage}`);
      return false;
    }
  };

  const getConfigValue = (key: string): any => {
    const config = configs.find(c => c.key === key);
    return config?.value;
  };

  return { configs, loading, updateConfig, fetchConfigs, getConfigValue };
};
