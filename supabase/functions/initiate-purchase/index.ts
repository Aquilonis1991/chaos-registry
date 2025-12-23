// 初始化購買流程
// 這個函數會根據平台返回不同的購買流程
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { getCorsHeaders, handleCorsPreFlight, validateOrigin } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  // 處理 CORS 預檢請求
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  // 驗證來源
  const originValidation = validateOrigin(req);
  if (originValidation) return originValidation;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // 獲取用戶認證
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { package_id, product_id, platform } = await req.json();

    if (!package_id || !product_id || !platform) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 產品映射
    const productMap: Record<string, { tokens: number; bonus: number }> = {
      token_pack_small: { tokens: 100, bonus: 0 },
      token_pack_medium: { tokens: 500, bonus: 50 },
      token_pack_large: { tokens: 1000, bonus: 150 },
      token_pack_xlarge: { tokens: 3000, bonus: 500 },
    };

    const productInfo = productMap[product_id];
    if (!productInfo) {
      return new Response(
        JSON.stringify({ error: 'Invalid product ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 根據平台返回不同的購買流程
    if (platform === 'android') {
      // Android: 返回 Google Play Billing 需要的資訊
      return new Response(
        JSON.stringify({
          platform: 'android',
          product_id: product_id,
          package_name: 'com.votechaos.app',
          action: 'initiate_google_play_purchase',
          // 這裡應該返回 Google Play Billing 的初始化資訊
          // 實際實作需要整合 Google Play Billing Library
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (platform === 'ios') {
      // iOS: 返回 App Store 需要的資訊
      return new Response(
        JSON.stringify({
          platform: 'ios',
          product_id: product_id,
          bundle_id: 'com.votechaos.app',
          action: 'initiate_app_store_purchase',
          // 這裡應該返回 App Store 的初始化資訊
          // 實際實作需要整合 StoreKit
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Initiate purchase error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

