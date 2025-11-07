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

// Rate limiting map: user_id -> { lastVote: timestamp, count: number }
const rateLimitMap = new Map<string, { lastVote: number; count: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_VOTES_PER_MINUTE = 10;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // 處理 CORS 預檢
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // 驗證來源（非 OPTIONS 請求）
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Invalid origin' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

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

    // Rate limiting check
    const now = Date.now();
    const userRateLimit = rateLimitMap.get(user.id);
    
    if (userRateLimit) {
      if (now - userRateLimit.lastVote < RATE_LIMIT_WINDOW) {
        if (userRateLimit.count >= MAX_VOTES_PER_MINUTE) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please wait before voting again.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        userRateLimit.count++;
      } else {
        userRateLimit.lastVote = now;
        userRateLimit.count = 1;
      }
    } else {
      rateLimitMap.set(user.id, { lastVote: now, count: 1 });
    }

    const { topic_id, option, amount } = await req.json();

    // Server-side input validation
    if (!topic_id || typeof topic_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid topic ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!option || typeof option !== 'string' || option.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid option' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!amount || typeof amount !== 'number' || amount < 1 || amount > 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid vote amount (1-100)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use atomic operation to deduct tokens first (prevents race conditions)
    const { data: updatedProfile, error: tokenError } = await supabaseClient
      .from('profiles')
      .select('tokens')
      .eq('id', user.id)
      .gte('tokens', amount)
      .single();

    if (tokenError || !updatedProfile) {
      return new Response(
        JSON.stringify({ error: 'Insufficient tokens' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Now deduct tokens atomically
    const { error: deductError } = await supabaseClient.rpc('deduct_tokens', {
      user_id: user.id,
      token_amount: amount
    });

    if (deductError) {
      console.error('Token deduction error:', deductError);
      return new Response(
        JSON.stringify({ error: 'Failed to deduct tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already voted on this topic
    const { data: existingVote } = await supabaseClient
      .from('votes')
      .select('id, amount, option')
      .eq('user_id', user.id)
      .eq('topic_id', topic_id)
      .maybeSingle();

    if (existingVote) {
      // Update existing vote
      const { error: updateError } = await supabaseClient
        .from('votes')
        .update({ amount: existingVote.amount + amount, option })
        .eq('id', existingVote.id);

      if (updateError) {
        console.error('Vote update error:', updateError);
        
        // Rollback: Refund tokens
        await supabaseClient.rpc('add_tokens', {
          user_id: user.id,
          token_amount: amount
        });
        
        return new Response(
          JSON.stringify({ error: 'Failed to update vote' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Create new vote
      const { error: voteError } = await supabaseClient
        .from('votes')
        .insert({
          user_id: user.id,
          topic_id,
          option,
          amount
        });

      if (voteError) {
        console.error('Vote creation error:', voteError);
        
        // Rollback: Refund tokens
        await supabaseClient.rpc('add_tokens', {
          user_id: user.id,
          token_amount: amount
        });
        
        return new Response(
          JSON.stringify({ error: 'Failed to cast vote' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add to topic_participants (ignore if exists)
      const { data: existingParticipant } = await supabaseClient
        .from('topic_participants')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('topic_id', topic_id)
        .maybeSingle();
      
      if (!existingParticipant) {
        await supabaseClient
          .from('topic_participants')
          .insert({
            user_id: user.id,
            topic_id
          });
      }
    }

    // Log transaction
    await supabaseClient
      .from('token_transactions')
      .insert({
        user_id: user.id,
        amount: -amount,
        transaction_type: 'cast_vote',
        reference_id: topic_id,
        description: `Voted on topic with ${amount} tokens`
      });

    // Log audit
    await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'cast_vote',
        resource_type: 'vote',
        resource_id: topic_id,
        metadata: { option, amount }
      });

    return new Response(
      JSON.stringify({ success: true, amount }),
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
