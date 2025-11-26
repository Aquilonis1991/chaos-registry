# 重新部署 watch-ad Edge Function 詳細步驟

## 方法一：通過 Supabase Dashboard（推薦，圖形界面）

### 步驟 1：登入 Supabase Dashboard
1. 打開瀏覽器，訪問：https://supabase.com/dashboard
2. 登入你的帳號
3. 選擇你的專案：`epyykzxxglkjombvozhr`

### 步驟 2：進入 Edge Functions 頁面
1. 在左側導航欄中，點擊 **"Edge Functions"**（邊緣函數）
2. 如果沒有看到，點擊 **"Project Settings"** → **"Edge Functions"**

### 步驟 3：找到 watch-ad 函數
1. 在函數列表中，找到 **"watch-ad"** 函數
2. 如果函數不存在，請參考「創建watch-ad-Edge-Function.md」先創建函數

### 步驟 4：編輯函數代碼
1. 點擊 **"watch-ad"** 函數名稱進入詳情頁
2. 點擊右上角的 **"Edit"**（編輯）按鈕
3. 將以下完整代碼複製並貼上到編輯器中：

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const ALLOWED_ORIGINS = [
  'https://epyykzxxglkjombvozhr.supabase.co',
  'capacitor://localhost',
  'https://localhost',  // Android Capacitor
  'http://localhost:5173',
  'http://localhost:8080',
];

const getCorsHeaders = (origin: string | null) => {
  // 處理 Android Capacitor 的 https://localhost
  const normalizedOrigin = origin === 'https://localhost' ? 'https://localhost' : origin;
  const allowedOrigin = normalizedOrigin && ALLOWED_ORIGINS.includes(normalizedOrigin) 
    ? normalizedOrigin 
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

const getClientIP = (req: Request): string => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';
};

// 從 system_config 讀取配置的輔助函數
const getSystemConfig = async (supabaseClient: any, key: string, defaultValue: any): Promise<any> => {
  try {
    const { data, error } = await supabaseClient
      .from('system_config')
      .select('value')
      .eq('key', key)
      .single();
    
    if (error || !data) {
      console.warn(`Config ${key} not found, using default:`, defaultValue);
      return defaultValue;
    }
    
    // 解析 JSONB 值
    const value = data.value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return value;
  } catch (error) {
    console.error(`Error fetching config ${key}:`, error);
    return defaultValue;
  }
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // 處理 CORS preflight 請求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Invalid origin' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const clientIP = getClientIP(req);

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 從 system_config 讀取配置
    const MAX_ADS_PER_DAY = await getSystemConfig(supabaseClient, 'max_ads_per_day', 
      await getSystemConfig(supabaseClient, 'mission_watch_ad_limit', 10));
    const AD_REWARD = await getSystemConfig(supabaseClient, 'ad_reward_amount',
      await getSystemConfig(supabaseClient, 'mission_watch_ad_reward', 5));

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tokens, ad_watch_count, last_login')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = profile.last_login ? new Date(profile.last_login).toISOString().split('T')[0] : null;
    
    let adWatchCount = profile.ad_watch_count;
    
    // Reset count if it's a new day
    if (lastLogin !== today) {
      adWatchCount = 0;
    }

    if (adWatchCount >= MAX_ADS_PER_DAY) {
      return new Response(
        JSON.stringify({ error: 'Daily ad watch limit reached', limit: MAX_ADS_PER_DAY }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use atomic operation to add tokens
    const { error: tokenError } = await supabaseClient.rpc('add_tokens', {
      user_id: user.id,
      token_amount: AD_REWARD
    });

    if (tokenError) {
      console.error('Token update error:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to award tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update ad watch count and last login
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        ad_watch_count: adWatchCount + 1,
        last_login: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log transaction
    await supabaseClient
      .from('token_transactions')
      .insert({
        user_id: user.id,
        amount: AD_REWARD,
        transaction_type: 'watch_ad',
        description: 'Watched advertisement'
      });

    // Log audit
    await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'watch_ad',
        resource_type: 'ad',
        metadata: { reward: AD_REWARD, daily_count: adWatchCount + 1 }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        reward: AD_REWARD, 
        remaining_ads: MAX_ADS_PER_DAY - (adWatchCount + 1) 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 步驟 5：保存並部署
1. 檢查代碼無誤後，點擊右上角的 **"Deploy"**（部署）按鈕
2. 等待部署完成（通常需要 10-30 秒）
3. 看到 **"Deployed successfully"**（部署成功）的提示

### 步驟 6：驗證部署
1. 在函數詳情頁面，查看 **"Deployments"**（部署記錄）標籤
2. 確認最新的部署狀態為 **"Active"**（活動中）
3. 查看 **"Logs"**（日誌）標籤，確認沒有錯誤

---

## 方法二：通過 Supabase CLI（命令行）

### 前置條件
1. 已安裝 Supabase CLI
2. 已登入 Supabase CLI
3. 已連接到你的專案

### 步驟 1：檢查 CLI 安裝
打開終端（PowerShell 或 CMD），執行：
```bash
supabase --version
```

如果沒有安裝，請先安裝：
```bash
npm install -g supabase
```

### 步驟 2：登入 Supabase
```bash
supabase login
```
按照提示在瀏覽器中完成登入。

### 步驟 3：連接到專案
```bash
cd C:\Users\USER\Documents\Mywork\votechaos-main
supabase link --project-ref epyykzxxglkjombvozhr
```

### 步驟 4：確認函數文件存在
確認以下文件存在：
```
votechaos-main/
  supabase/
    functions/
      watch-ad/
        index.ts
```

### 步驟 5：部署函數
```bash
supabase functions deploy watch-ad
```

### 步驟 6：驗證部署
部署完成後，你會看到類似以下的輸出：
```
Deploying function watch-ad...
Function watch-ad deployed successfully
```

### 步驟 7：查看日誌（可選）
```bash
supabase functions logs watch-ad
```

---

## 驗證部署是否成功

### 方法 1：在 Supabase Dashboard 中查看
1. 進入 **Edge Functions** 頁面
2. 點擊 **watch-ad** 函數
3. 查看 **"Deployments"** 標籤，確認最新部署狀態為 **"Active"**

### 方法 2：測試函數（使用 SQL Editor）
在 Supabase Dashboard 的 SQL Editor 中執行：

```sql
-- 測試 Edge Function 是否可訪問
SELECT 
  'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/watch-ad' as function_url,
  'POST' as method,
  '需要 Authorization header' as note;
```

### 方法 3：在 Android Studio 中測試
1. 重新構建並運行應用
2. 嘗試觀看廣告
3. 查看 Logcat，確認沒有 CORS 錯誤
4. 確認廣告觀看後能正常獲取代幣

---

## 常見問題排查

### 問題 1：部署失敗 - "Function not found"
**解決方案**：
- 先創建函數（參考「創建watch-ad-Edge-Function.md」）
- 或使用 Dashboard 手動創建函數

### 問題 2：部署失敗 - "Authentication failed"
**解決方案**：
```bash
supabase login
```

### 問題 3：部署失敗 - "Project not linked"
**解決方案**：
```bash
supabase link --project-ref epyykzxxglkjombvozhr
```

### 問題 4：CORS 錯誤仍然存在
**解決方案**：
1. 確認已更新 CORS 配置（包含 `https://localhost`）
2. 清除瀏覽器緩存
3. 重新構建 Android 應用

### 問題 5：函數調用超時
**解決方案**：
1. 檢查 `add_tokens_from_ad_watch` RPC 函數是否正常
2. 查看 Edge Function 日誌，確認錯誤詳情
3. 檢查數據庫連接是否正常

---

## 更新日誌

### 2025-11-23 更新
- ✅ 添加 `https://localhost` 到 CORS 允許列表（支持 Android Capacitor）
- ✅ 優化 CORS 處理邏輯
- ✅ 優先使用 `mission_watch_ad_limit` 配置鍵

---

## 下一步

部署完成後，請：
1. 在 Android Studio 中重新構建應用
2. 測試觀看廣告功能
3. 確認配置讀取正確（查看 Logcat）
4. 確認沒有 CORS 錯誤
5. 確認能正常獲取代幣

