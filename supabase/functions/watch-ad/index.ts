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
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const requestStart = Date.now();

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
      console.warn('[watch-ad] Unauthorized request', { requestId, clientIP });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[watch-ad] user authenticated', { requestId, userId: user.id, clientIP });

    // 從 system_config 讀取配置（一次性讀取所有需要的配置，避免多次查詢）
    const { data: configData, error: configError } = await supabaseClient
      .from('system_config')
      .select('key, value')
      .in('key', ['mission_watch_ad_limit', 'mission_watch_ad_reward']);
    
    // 構建配置映射（已統一使用 mission_watch_ad_limit / mission_watch_ad_reward）
    const configMap: Record<string, any> = {};
    if (configData) {
      configData.forEach(item => {
        let value = item.value;
        // 處理 JSONB 值
        if (typeof value === 'string' && !isNaN(Number(value))) {
          value = Number(value);
        }
        configMap[item.key] = value;
      });
    }
    
    const MAX_ADS_PER_DAY = configMap['mission_watch_ad_limit'] ?? 10;
    const AD_REWARD = configMap['mission_watch_ad_reward'] ?? 5;
    
    console.log('[watch-ad] config values', { requestId, MAX_ADS_PER_DAY, AD_REWARD, configMap });

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tokens, ad_watch_count, last_login')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[watch-ad] Failed to fetch profile', { requestId, profileError });
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
      console.warn('[watch-ad] daily limit reached', { requestId, userId: user.id, adWatchCount, MAX_ADS_PER_DAY });
      return new Response(
        JSON.stringify({ error: 'Daily ad watch limit reached', limit: MAX_ADS_PER_DAY }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[watch-ad] proceeding to add tokens', {
      requestId,
      userId: user.id,
      currentCount: adWatchCount,
      MAX_ADS_PER_DAY,
      AD_REWARD
    });

    // Step 1: Update ad watch count / last_login first.
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        ad_watch_count: adWatchCount + 1,
        last_login: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[watch-ad] profile update error', { requestId, updateError });
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Add tokens (balance update).
    const { error: tokenError } = await supabaseClient.rpc('add_tokens', {
      user_id: user.id,
      token_amount: AD_REWARD
    });

    if (tokenError) {
      console.error('[watch-ad] token update error', { requestId, tokenError });
      return new Response(
        JSON.stringify({ error: 'Failed to award tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Write transaction record (must succeed).
    const { error: txError } = await supabaseClient
      .from('token_transactions')
      .insert({
        user_id: user.id,
        amount: AD_REWARD,
        transaction_type: 'watch_ad',
        description: 'Watched advertisement'
      });

    if (txError) {
      console.error('[watch-ad] transaction log error, start compensation', { requestId, txError });

      // Compensation: rollback token balance so we never end in "balance changed but no transaction log".
      const { error: rollbackError } = await supabaseClient.rpc('add_tokens', {
        user_id: user.id,
        token_amount: -AD_REWARD
      });

      if (rollbackError) {
        console.error('[watch-ad] compensation failed', { requestId, rollbackError });
      }

      return new Response(
        JSON.stringify({ error: 'Failed to write transaction log, token award rolled back' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Audit log is optional and should not break reward flow.
    const { error: auditError } = await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'watch_ad',
        resource_type: 'ad',
        metadata: { reward: AD_REWARD, daily_count: adWatchCount + 1 }
      });

    if (auditError) {
      console.warn('[watch-ad] audit log error', { requestId, auditError });
    }

    console.log('[watch-ad] success', {
      requestId,
      userId: user.id,
      totalDurationMs: Date.now() - requestStart,
      newCount: adWatchCount + 1,
      remaining: MAX_ADS_PER_DAY - (adWatchCount + 1)
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
    console.error('[watch-ad] unexpected error', { requestId, error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
