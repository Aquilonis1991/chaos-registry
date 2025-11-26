import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const ALLOWED_ORIGINS = [
  'https://epyykzxxglkjombvozhr.supabase.co',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
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

    const { mission_id } = await req.json();

    // Server-side input validation
    if (!mission_id || typeof mission_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid mission ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get mission details
    const { data: mission, error: missionError } = await supabaseClient
      .from('missions')
      .select('*')
      .eq('id', mission_id)
      .single();

    if (missionError || !mission) {
      return new Response(
        JSON.stringify({ error: 'Mission not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create user mission
    const { data: userMission } = await supabaseClient
      .from('user_missions')
      .select('*')
      .eq('user_id', user.id)
      .eq('mission_id', mission_id)
      .maybeSingle();

    if (userMission && userMission.completed) {
      // Check if daily limit applies
      if (mission.limit_per_day) {
        const today = new Date().toISOString().split('T')[0];
        if (userMission.last_completed_date === today) {
          return new Response(
            JSON.stringify({ error: 'Daily mission limit reached' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Mission already completed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update or create user mission
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    
    if (userMission) {
      await supabaseClient
        .from('user_missions')
        .update({
          completed: true,
          completed_at: now,
          last_completed_date: today,
          progress: 100
        })
        .eq('id', userMission.id);
    } else {
      await supabaseClient
        .from('user_missions')
        .insert({
          user_id: user.id,
          mission_id,
          completed: true,
          completed_at: now,
          last_completed_date: today,
          progress: 100
        });
    }

    // Use atomic operation to add tokens
    const { error: tokenError } = await supabaseClient.rpc('add_tokens', {
      user_id: user.id,
      token_amount: mission.reward
    });

    if (tokenError) {
      console.error('Token update error:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to award tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log transaction
    await supabaseClient
      .from('token_transactions')
      .insert({
        user_id: user.id,
        amount: mission.reward,
        transaction_type: 'complete_mission',
        reference_id: mission_id,
        description: `Completed mission: ${mission.name}`
      });

    // Log audit
    await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'complete_mission',
        resource_type: 'mission',
        resource_id: mission_id,
        metadata: { mission_name: mission.name, reward: mission.reward }
      });

    return new Response(
      JSON.stringify({ success: true, reward: mission.reward }),
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
