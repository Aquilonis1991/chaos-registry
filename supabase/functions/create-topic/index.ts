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

    // add_tokens/deduct_tokens 已收回 authenticated 執行權限（安全修正：這兩個函式先前對任何
    // 已登入用戶開放，可直接被 client 呼叫竄改任意數量代幣）。改用 service role 呼叫，
    // 使用者身份仍由上面的 supabaseClient.auth.getUser() 驗證過，只是代幣異動改走特權連線。
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    const { title, options, category, tags, exposure_level, duration_days, end_at, description } = await req.json();

    // Fetch system config
    const { data: configData } = await supabaseClient
      .from('system_config')
      .select('key, value')
      .in('key', [
        'title_min_length', 'title_max_length', 'description_max_length',
        'option_min_count', 'option_max_count', 'option_item_max_length',
        'tags_max_count',
        'exposure_costs', 'duration_costs', 'duration_min_days', 'duration_max_days',
        'topic_banned_check_levels'
      ]);

    const config = (configData || []).reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, any>);

    // Get config values with fallbacks
    const titleMinLength = config.title_min_length || 5;
    const titleMaxLength = config.title_max_length || 80;
    const descMaxLength = config.description_max_length || 500;
    const optionMinCount = config.option_min_count || 2;
    const optionMaxCount = config.option_max_count || 6;
    const optionItemMaxLength = config.option_item_max_length || 50;
    const tagsMaxCount = config.tags_max_count || 5;
    const durationMinDays = config.duration_min_days || 1;
    const durationMaxDays = config.duration_max_days || 30;
    const exposureCosts = config.exposure_costs || { normal: 10, medium: 50, high: 200 };
    const durationCosts = config.duration_costs || {};
    const topicBannedLevels = config.topic_banned_check_levels || ['A', 'B', 'C', 'D', 'E'];

    // Validate against banned words
    const lightenOptions = (options || []).map((opt: any) => (
      typeof opt === 'string' ? opt : (opt?.text ?? '')
    ));

    const { data: validationResult, error: validationError } = await supabaseClient
      .rpc('validate_topic_content', {
        p_title: title,
        p_description: description || null,
        p_options: JSON.stringify(lightenOptions),
        p_tags: tags || [],
        p_category: category || null,
        p_check_levels: topicBannedLevels
      });

    if (validationError) {
      console.error('Banned words validation error:', validationError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate content' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validationResult?.[0];
    if (validation && validation.is_valid === false) {
      const action = validation.matched_action || 'block';
      if (action === 'review') {
        // 允許 review 等級，由管理員後續審核
      } else {
        return new Response(
          JSON.stringify({
            error: `Forbidden keyword detected in ${validation.field_name}: ${validation.matched_keyword}`,
            keyword: validation.matched_keyword,
            level: validation.matched_level,
            action: validation.matched_action,
            field: validation.field_name
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Server-side input validation with dynamic config
    if (!title || typeof title !== 'string' || title.trim().length < titleMinLength || title.trim().length > titleMaxLength) {
      return new Response(
        JSON.stringify({ error: `Title must be between ${titleMinLength} and ${titleMaxLength} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate description if provided
    if (description && (typeof description !== 'string' || description.trim().length > descMaxLength)) {
      return new Response(
        JSON.stringify({ error: `Description must not exceed ${descMaxLength} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(options) || options.length < optionMinCount || options.length > optionMaxCount) {
      return new Response(
        JSON.stringify({ error: `Must have between ${optionMinCount} and ${optionMaxCount} options` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const option of options) {
      if (!option || typeof option !== 'string' || option.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'All options must be non-empty strings' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (option.trim().length > optionItemMaxLength) {
        return new Response(
          JSON.stringify({ error: `Each option must not exceed ${optionItemMaxLength} characters` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const validExposureLevels = ['normal', 'medium', 'high'];
    if (!validExposureLevels.includes(exposure_level)) {
      return new Response(
        JSON.stringify({ error: 'Invalid exposure level' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!duration_days || duration_days < durationMinDays || duration_days > durationMaxDays) {
      return new Response(
        JSON.stringify({ error: `Duration must be between ${durationMinDays} and ${durationMaxDays} days` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(tags) || tags.length > tagsMaxCount) {
      return new Response(
        JSON.stringify({ error: `Maximum ${tagsMaxCount} tags allowed` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate cost from dynamic config
    const exposureCost =
      exposureCosts[exposure_level as keyof typeof exposureCosts]
      || 30;
    const durationCost = durationCosts[duration_days.toString()] || 0;
    const totalCost = exposureCost + durationCost;

    // Check if user has free create qualification
    const { data: hasFreeQualification } = await supabaseClient.rpc('has_free_create_qualification', {
      check_user_id: user.id
    });

    // Create topic first（與 DB topics_exposure_level_check：normal|medium|high 一致）
    const { data: topic, error: topicError } = await supabaseClient
      .from('topics')
      .insert({
        creator_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        options: options,
        tags: tags || [],
        exposure_level,
        duration_days,
        end_at,
        status: 'active',
        votes: {}
      })
      .select()
      .single();

    if (topicError || !topic) {
      console.error('Topic creation error:', topicError);
      return new Response(
        JSON.stringify({ error: 'Failed to create topic' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle token deduction or free qualification usage
    if (hasFreeQualification) {
      // Use free create qualification
      try {
        await supabaseClient.rpc('use_free_create_qualification', {
          check_user_id: user.id
        });
      } catch (error) {
        console.error('Free qualification usage error:', error);
        
        // Rollback: Delete the created topic
        await supabaseClient
          .from('topics')
          .delete()
          .eq('id', topic.id);
        
        return new Response(
          JSON.stringify({ error: 'Failed to use free create qualification' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Use atomic operation to deduct tokens
      try {
        await supabaseAdmin.rpc('deduct_tokens', {
          user_id: user.id,
          token_amount: totalCost
        });
      } catch (error) {
        console.error('Token deduction error:', error);
        
        // Rollback: Delete the created topic
        await supabaseClient
          .from('topics')
          .delete()
          .eq('id', topic.id);
        
        return new Response(
          JSON.stringify({ error: 'Insufficient tokens or failed to deduct tokens' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log transaction
    await supabaseClient
      .from('token_transactions')
      .insert({
        user_id: user.id,
        amount: hasFreeQualification ? 0 : -totalCost,
        transaction_type: hasFreeQualification ? 'free_create_topic' : 'create_topic',
        reference_id: topic.id,
        description: hasFreeQualification 
          ? `Created topic for free: ${title}`
          : `Created topic: ${title}`
      });

    // Add to topic_creators junction table
    await supabaseClient
      .from('topic_creators')
      .insert({
        user_id: user.id,
        topic_id: topic.id
      });

    // Log audit
    await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'create_topic',
        resource_type: 'topic',
        resource_id: topic.id,
        metadata: { title, cost: totalCost }
      });

    return new Response(
      JSON.stringify({ success: true, topic, cost: totalCost }),
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
