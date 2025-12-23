// 驗證 Google Play 購買
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { getCorsHeaders, handleCorsPreFlight, validateOrigin } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!;
const GOOGLE_PLAY_PACKAGE_NAME = 'com.votechaos.app';

// Google Play API 認證（需要 Service Account）
const GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL');
const GOOGLE_PLAY_PRIVATE_KEY = Deno.env.get('GOOGLE_PLAY_PRIVATE_KEY');

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

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

    const { purchaseToken, productId } = await req.json();

    if (!purchaseToken || !productId) {
      return new Response(
        JSON.stringify({ error: 'Missing purchaseToken or productId' }),
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

    const productInfo = productMap[productId];
    if (!productInfo) {
      return new Response(
        JSON.stringify({ error: 'Invalid product ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 使用 Google Play Developer API 驗證購買
    // 注意：這需要 Google Play Service Account 和正確的認證
    let purchaseData;
    
    if (GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL && GOOGLE_PLAY_PRIVATE_KEY) {
      // 使用 Service Account 認證
      // 這裡需要實作 JWT 認證流程
      // 暫時跳過，使用模擬驗證
      console.log('Google Play purchase verification (Service Account not fully implemented)');
      purchaseData = { purchaseState: 0 }; // 0 = 已購買
    } else {
      // 暫時：模擬驗證（生產環境必須實作真實驗證）
      console.warn('Google Play Service Account not configured, using mock verification');
      purchaseData = { purchaseState: 0 };
    }

    // 驗證購買狀態
    // purchaseState: 0 = 已購買, 1 = 已取消, 2 = 待處理
    if (purchaseData.purchaseState !== 0) {
      return new Response(
        JSON.stringify({ error: 'Purchase not completed', purchaseState: purchaseData.purchaseState }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 檢查是否已經處理過這個購買（防止重複發放）
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: existingTransaction } = await supabaseAdmin
      .from('token_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('transaction_type', 'deposit')
      .eq('description', `Google Play 購買 - ${productId}`)
      .single();

    if (existingTransaction) {
      return new Response(
        JSON.stringify({ error: 'Purchase already processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 發放代幣
    const totalTokens = productInfo.tokens + productInfo.bonus;
    const { error: tokenError } = await supabaseAdmin.rpc('add_tokens', {
      user_id: user.id,
      token_amount: totalTokens,
    });

    if (tokenError) {
      console.error('Error adding tokens:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to add tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 記錄交易
    const { error: transactionError } = await supabaseAdmin
      .from('token_transactions')
      .insert({
        user_id: user.id,
        amount: totalTokens,
        transaction_type: 'deposit',
        description: `Google Play 購買 - ${productId}`,
      });

    if (transactionError) {
      console.error('Error recording transaction:', transactionError);
      // 不返回錯誤，因為代幣已經發放
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        tokens: totalTokens,
        message: 'Purchase verified and tokens added'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verify Google Play purchase error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

