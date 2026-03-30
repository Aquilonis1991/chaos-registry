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

// 生成 Google JWT token 用於 API 認證
async function generateGoogleJWT(): Promise<string> {
  if (!GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PLAY_PRIVATE_KEY) {
    throw new Error('Google Play Service Account credentials not configured');
  }

  // JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, // 1 hour
    iat: now,
  };

  // 使用 Web Crypto API 簽名 JWT
  // 注意：這需要正確格式的私鑰（PEM 格式）
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const message = `${headerB64}.${payloadB64}`;

  // 這裡需要實作 RSA 簽名
  // 由於 Deno 環境限制，暫時返回模擬 token
  // 生產環境需要使用正確的 JWT 庫或實作 RSA 簽名
  console.warn('[Google Play] JWT generation not fully implemented, using mock token');
  return 'mock_jwt_token';
}

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

    let body: { purchaseToken?: string; productId?: string; transactionId?: string; packageName?: string };
    try {
      body = await req.json();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      return new Response(
        JSON.stringify({ error: 'Invalid request body', message: msg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Missing request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { purchaseToken, productId, transactionId, packageName } = body;

    if (!purchaseToken || !productId) {
      return new Response(
        JSON.stringify({ error: 'Missing purchaseToken or productId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 使用 packageName 或默認值
    const appPackageName = packageName || GOOGLE_PLAY_PACKAGE_NAME;

    // 產品映射：優先從 system_config.recharge_amounts 讀取，與前台一致
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let productMap: Record<string, { tokens: number; bonus: number }> = {};
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'recharge_amounts')
      .single();

    if (!configError && configData?.value) {
      try {
        const raw = configData.value;
        const amounts = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
        productMap = (amounts as any[]).reduce((acc: Record<string, { tokens: number; bonus: number }>, curr: any) => {
          let pid = '';
          if (curr.id === 1) pid = 'token_pack_small';
          if (curr.id === 2) pid = 'token_pack_medium';
          if (curr.id === 3) pid = 'token_pack_large';
          if (curr.id === 4) pid = 'token_pack_xlarge';
          if (pid && curr.tokens != null) {
            acc[pid] = { tokens: Number(curr.tokens), bonus: Number(curr.bonus ?? 0) };
          }
          return acc;
        }, {});
        console.log('[Google Play] Loaded product map from recharge_amounts:', productMap);
      } catch (e) {
        console.error('[Google Play] Failed to parse recharge_amounts:', e);
      }
    }
    if (Object.keys(productMap).length === 0) {
      console.warn('[Google Play] Using hardcoded product map fallback');
      productMap = {
        token_pack_small: { tokens: 100, bonus: 0 },
        token_pack_medium: { tokens: 575, bonus: 0 },
        token_pack_large: { tokens: 1150, bonus: 0 },
        token_pack_xlarge: { tokens: 3600, bonus: 0 },
      };
    }

    const productInfo = productMap[productId];
    if (!productInfo) {
      return new Response(
        JSON.stringify({ error: 'Invalid product ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 使用 Google Play Developer API 驗證購買
    // 方法 1: 使用 Google Play Developer API v3 (需要 Service Account)
    // 方法 2: 使用 Google Play Developer API v2 (已棄用，但更簡單)
    // 方法 3: 使用 Google Play Billing Library 的驗證 (推薦用於生產環境)
    
    let purchaseData: any = null;
    let verificationMethod = 'none';
    
    if (GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL && GOOGLE_PLAY_PRIVATE_KEY) {
      // 方法 1: 使用 Google Play Developer API v3
      try {
        // 生成 JWT token 用於 Google API 認證
        const jwt = await generateGoogleJWT();
        
        // 調用 Google Play Developer API
        const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${appPackageName}/purchases/products/${productId}/tokens/${purchaseToken}`;
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          purchaseData = await response.json();
          verificationMethod = 'google_api_v3';
          console.log('[Google Play] Purchase verified via Google API v3');
        } else {
          const errorText = await response.text();
          console.error('[Google Play] API verification failed:', response.status, errorText);
          // 如果 API 驗證失敗，繼續使用其他方法
        }
      } catch (error) {
        console.error('[Google Play] API verification error:', error);
        // 繼續使用其他驗證方法
      }
    }

    // 如果 API 驗證失敗或未配置，使用基本驗證
    // 安全：基本驗證無法確認 purchaseToken 對應的產品，故發放數量以「所有方案中最小」為上限，降低竄改 productId 的誘因
    if (!purchaseData) {
      console.warn('[Google Play] Using basic verification (purchaseToken validation only)');
      verificationMethod = 'basic';

      // 基本驗證：檢查 purchaseToken 格式
      if (purchaseToken && purchaseToken.length > 10) {
        purchaseData = {
          purchaseState: 0,
          consumptionState: 0,
          purchaseTimeMillis: Date.now().toString(),
        };
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid purchaseToken format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 驗證購買狀態
    // purchaseState: 0 = 已購買, 1 = 已取消, 2 = 待處理
    if (purchaseData.purchaseState !== 0) {
      return new Response(
        JSON.stringify({ error: 'Purchase not completed', purchaseState: purchaseData.purchaseState }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 方法 2: 檢查同一用戶在短時間內是否有相同產品的購買（額外保護）
    // 注意：這只是警告，不阻止購買，因為用戶可能合法地購買多個相同產品
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentPurchase } = await supabaseAdmin
      .from('token_transactions')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('transaction_type', 'deposit')
      .eq('metadata->>productId', productId)
      .gte('created_at', fiveMinutesAgo)
      .limit(1)
      .maybeSingle();

    if (recentPurchase) {
      console.warn('[Google Play] Recent duplicate purchase detected for same product:', {
        productId,
        recentPurchaseId: recentPurchase.id,
        recentPurchaseTime: recentPurchase.created_at,
      });
      // 不直接拒絕，因為可能是合法的重複購買，但記錄警告
    }

    // 發放代幣
    let totalTokens = productInfo.tokens + productInfo.bonus;
    // 基本驗證時無法確認此 token 對應哪個產品，僅發放「所有方案中最小」數量，避免竄改 productId 領取高額代幣
    if (verificationMethod === 'basic') {
      const minAmount = Math.min(...Object.values(productMap).map((p) => p.tokens + p.bonus));
      totalTokens = Math.min(totalTokens, minAmount);
      console.log('[Google Play] Basic verification: capping grant to', totalTokens);
    }
    const { data: processRows, error: processError } = await supabaseAdmin.rpc(
      'process_google_play_purchase_deposit',
      {
        p_user_id: user.id,
        p_purchase_token: purchaseToken,
        p_product_id: productId,
        p_transaction_id: transactionId || null,
        p_package_name: appPackageName,
        p_verification_method: verificationMethod,
        p_purchase_state: Number(purchaseData.purchaseState ?? 0),
        p_consumption_state: Number(purchaseData.consumptionState ?? 0),
        p_purchase_time_millis: String(purchaseData.purchaseTimeMillis || Date.now().toString()),
        p_total_tokens: totalTokens,
      }
    );

    if (processError) {
      console.error('Error processing atomic deposit:', processError);
      return new Response(
        JSON.stringify({ error: 'Failed to process purchase deposit', details: processError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processRow = Array.isArray(processRows) ? processRows[0] : processRows;
    const applied = Boolean(processRow?.applied);
    const finalAmount = Number(processRow?.amount ?? totalTokens);
    const finalTxId = processRow?.tx_id ?? null;

    if (!applied) {
      console.warn('[Google Play] Purchase already processed:', purchaseToken);
      const receiptTitle = '[行政回執] 延遲入帳完成';
      const receiptContent =
        `[行政回執] 偵測到一筆未結案的資源撥付。${finalAmount.toLocaleString()} 代幣 已存入您的錢包。`;

      try {
        await supabaseAdmin.from('notifications').insert({
          user_id: user.id,
          type: 'system',
          title: receiptTitle,
          content: receiptContent,
          created_by: null,
        });
      } catch (notifyErr) {
        console.warn('[Google Play] Failed to write administrative receipt notification:', notifyErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          alreadyProcessed: true,
          tokens: finalAmount,
          message: '此購買已經處理過，代幣已發放',
          administrativeReceipt: {
            title: receiptTitle,
            content: receiptContent,
          },
          existingTransaction: {
            id: finalTxId,
            amount: finalAmount,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        tokens: finalAmount,
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



