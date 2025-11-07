import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

// 允許的來源
const ALLOWED_ORIGINS = [
  'https://epyykzxxglkjombvozhr.supabase.co',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:8080',
];

// 獲取 CORS 標頭
const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

// 獲取客戶端 IP
const getClientIP = (req: Request): string => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 
         req.headers.get('cf-connecting-ip') || 
         'unknown';
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // 處理 CORS 預檢
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // 驗證來源
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Invalid origin' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 記錄 IP
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

    const { topic_id, option } = await req.json();

    // Server-side input validation
    if (!topic_id || !option) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: topic_id, option' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if topic exists and is active
    const { data: topic, error: topicError } = await supabaseClient
      .from('topics')
      .select('id, status, options, end_at')
      .eq('id', topic_id)
      .single();

    if (topicError || !topic) {
      return new Response(
        JSON.stringify({ error: 'Topic not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (topic.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Topic is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if topic has ended
    if (new Date(topic.end_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Topic has ended' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate option exists in topic
    const options = topic.options as any[];
    if (!options.some(opt => opt.id === option)) {
      return new Response(
        JSON.stringify({ error: 'Invalid option' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already used free vote today for this topic
    const { data: existingFreeVote } = await supabaseClient
      .from('free_votes')
      .select('id')
      .eq('user_id', user.id)
      .eq('topic_id', topic_id)
      .gte('used_at', new Date().toISOString().split('T')[0]) // Today
      .maybeSingle();

    if (existingFreeVote) {
      return new Response(
        JSON.stringify({ error: 'Free vote already used today for this topic' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cast free vote using the database function
    const { data: result, error: voteError } = await supabaseClient
      .rpc('cast_free_vote', {
        p_topic_id: topic_id,
        p_option: option
      });

    if (voteError) {
      console.error('Free vote error:', voteError);
      return new Response(
        JSON.stringify({ error: 'Failed to cast free vote' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Free vote cast successfully',
        data: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

