import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const ALLOWED_ORIGINS = [
  'https://epyykzxxglkjombvozhr.supabase.co',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:8080',
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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

const AD_REWARD = 5;
const MAX_ADS_PER_DAY = 10;

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
