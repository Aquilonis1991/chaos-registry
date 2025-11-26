import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      global: {
        headers: {
          // 不使用使用者的 Authorization，避免 RLS 限制
        },
      },
    });

    // Get all system configs
    const { data: configs, error } = await supabaseClient
      .from('system_config')
      .select('key, value');

    if (error) throw error;

    // Convert to key-value object
    const configMap = configs.reduce((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {} as Record<string, any>);

    const topicBannedConfig = configs.find(c => c.key === 'topic_banned_check_levels');
    if (!topicBannedConfig) {
      const defaultLevels = ['A', 'B', 'C', 'D', 'E'];
      const { data: insertData, error: insertError } = await supabaseClient
        .from('system_config')
        .insert({
          key: 'topic_banned_check_levels',
          value: defaultLevels,
          category: 'validation',
          description: '建立主題與標籤時需要拒絕的禁字級別（JSON 陣列）'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting default topic_banned_check_levels:', insertError.message);
      } else if (insertData) {
        configMap['topic_banned_check_levels'] = insertData.value;
      }
    }

    return new Response(
      JSON.stringify({ configs: configMap }),
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
