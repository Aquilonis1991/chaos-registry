// 驗證 App Store 購買（完整版本 - 使用 App Store Server API）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { create, type Header, type Payload } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';
import { getCorsHeaders, handleCorsPreFlight, validateOrigin } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!;

// App Store Server API 配置（完整版本）
const APP_STORE_KEY_ID = Deno.env.get('APP_STORE_KEY_ID'); // App Store Connect API Key ID
const APP_STORE_ISSUER_ID = Deno.env.get('APP_STORE_ISSUER_ID'); // App Store Connect Issuer ID
const APP_STORE_PRIVATE_KEY = Deno.env.get('APP_STORE_PRIVATE_KEY'); // App Store Connect Private Key (PEM format)
const APP_STORE_BUNDLE_ID = Deno.env.get('APP_STORE_BUNDLE_ID') || 'com.votechaos.app';

// 舊版 VerifyReceipt API（fallback，如果提供了 receiptData）
const APP_STORE_SHARED_SECRET = Deno.env.get('APP_STORE_SHARED_SECRET');

/**
 * 生成 App Store Server API 的 JWT Token（完整版本 - ES256 簽名）
 * 參考：https://developer.apple.com/documentation/appstoreserverapi/generating_tokens_for_api_requests
 */
async function generateAppStoreJWT(): Promise<string> {
  if (!APP_STORE_KEY_ID || !APP_STORE_ISSUER_ID || !APP_STORE_PRIVATE_KEY) {
    throw new Error('App Store Server API credentials not configured');
  }

  // JWT Payload
  // 根據 Apple 官方文檔：https://developer.apple.com/documentation/appstoreserverapi/generating_tokens_for_api_requests
  // JWT payload 需要：iss, iat, exp, aud, bid
  // 注意：bid 必須是你的 App Bundle ID（例如：com.votechaos.app）
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = {
    iss: APP_STORE_ISSUER_ID,
    iat: now,
    exp: now + 3600, // 1 hour expiration
    aud: 'appstoreconnect-v1',
    bid: APP_STORE_BUNDLE_ID,
  };

  try {
    // Edge Functions 的 secret 常會把換行轉成 \n，這裡做一次還原
    const pem = APP_STORE_PRIVATE_KEY.includes('\\n')
      ? APP_STORE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : APP_STORE_PRIVATE_KEY;

    if (!pem.includes('BEGIN') || !pem.includes('END')) {
      throw new Error('APP_STORE_PRIVATE_KEY must be a PEM (p8) private key');
    }

    const key = await crypto.subtle.importKey(
      'pkcs8',
      // Deno 的 importKey 需要 ArrayBuffer
      new Uint8Array(
        Array.from(atob(pem
          .replace(/-----BEGIN PRIVATE KEY-----/g, '')
          .replace(/-----END PRIVATE KEY-----/g, '')
          .replace(/\s/g, '')),
          (c) => c.charCodeAt(0)
        )
      ).buffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    const header: Header = { alg: 'ES256', kid: APP_STORE_KEY_ID, typ: 'JWT' };
    const jwt = await create(header, payload, key);
    console.log('[Verify] JWT token generated successfully');
    return jwt;
  } catch (error) {
    console.error('[Verify] JWT generation failed:', error);
    throw new Error(`Failed to generate JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 使用 App Store Server API 驗證 transactionId
 * 參考：https://developer.apple.com/documentation/appstoreserverapi/get_transaction_info
 */
async function verifyTransactionWithServerAPI(transactionId: string, productId: string): Promise<{
  valid: boolean;
  productId?: string;
  purchaseDate?: number;
  environment?: string;
  error?: string;
}> {
  try {
    // 生成 JWT Token
    const jwtToken = await generateAppStoreJWT();

    const hosts = [
      'https://api.storekit.itunes.apple.com',
      'https://api.storekit-sandbox.itunes.apple.com',
    ];

    let lastErr = '';
    let triedHosts: string[] = [];
    for (const host of hosts) {
      const apiUrl = `${host}/inApps/v1/transactions/${transactionId}`;
      triedHosts.push(host);
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API error (${host}): ${response.status} - ${errorText}`;
        
        // 如果是 401 且還有其他端點未嘗試，只記錄為警告（這是預期行為：Sandbox 交易在 Production 端點會返回 401）
        if (response.status === 401 && triedHosts.length < hosts.length) {
          console.log(`[Verify] Production endpoint returned 401 (expected for Sandbox transactions), trying Sandbox endpoint...`);
          lastErr = errorMsg;
          continue;
        }
        
        // 其他錯誤或所有端點都失敗時，記錄為錯誤
        lastErr = errorMsg;
        console.error('[Verify] App Store Server API error:', lastErr);
        continue;
      }

      const json = await response.json();
      const signedTransactionInfo = json?.signedTransactionInfo;
      if (typeof signedTransactionInfo !== 'string' || !signedTransactionInfo.includes('.')) {
        return { valid: false, error: 'Missing signedTransactionInfo from App Store Server API' };
      }

      // signedTransactionInfo 是 JWS：header.payload.signature
      const parts = signedTransactionInfo.split('.');
      if (parts.length !== 3) return { valid: false, error: 'Invalid signedTransactionInfo format' };

      const payloadB64 = parts[1];
      const padding = '='.repeat((4 - (payloadB64.length % 4)) % 4);
      const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/') + padding);
      const payload = JSON.parse(payloadJson);

      console.log('[Verify] Transaction payload (from App Store Server API):', {
        transactionId: payload?.transactionId,
        originalTransactionId: payload?.originalTransactionId,
        productId: payload?.productId,
        purchaseDate: payload?.purchaseDate,
        environment: payload?.environment,
        revocationDate: payload?.revocationDate,
      });

      if (payload?.productId !== productId) {
        return { valid: false, error: `Product ID mismatch: expected ${productId}, got ${payload?.productId}` };
      }
      if (payload?.revocationDate) {
        return { valid: false, error: 'Transaction has been revoked (refunded)' };
      }

      return {
        valid: true,
        productId: payload?.productId,
        purchaseDate: payload?.purchaseDate,
        environment: payload?.environment || (host.includes('sandbox') ? 'Sandbox' : 'Production'),
      };
    }

    return { valid: false, error: lastErr || 'Unknown App Store Server API error' };
  } catch (error) {
    console.error('[Verify] App Store Server API verification failed:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 使用舊版 VerifyReceipt API 驗證 receipt（fallback）
 */
async function verifyReceiptWithLegacyAPI(receiptData: string): Promise<{
  valid: boolean;
  status?: number;
  error?: string;
}> {
  if (!APP_STORE_SHARED_SECRET) {
    return {
      valid: false,
      error: 'APP_STORE_SHARED_SECRET not configured',
    };
  }

  // 先嘗試生產環境
  let verifyUrl = 'https://buy.itunes.apple.com/verifyReceipt';
  
  try {
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': APP_STORE_SHARED_SECRET,
        'exclude-old-transactions': true,
      }),
    });

    const result = await response.json();
    
    // 如果是沙盒環境（status 21007），切換到沙盒 URL
    if (result.status === 21007) {
      verifyUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
      const sandboxResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receiptData,
          'password': APP_STORE_SHARED_SECRET,
          'exclude-old-transactions': true,
        }),
      });
      const sandboxResult = await sandboxResponse.json();
      return {
        valid: sandboxResult.status === 0,
        status: sandboxResult.status,
        error: sandboxResult.status !== 0 ? `Status ${sandboxResult.status}` : undefined,
      };
    }

    return {
      valid: result.status === 0,
      status: result.status,
      error: result.status !== 0 ? `Status ${result.status}` : undefined,
    };
  } catch (error) {
    console.error('[Verify] Legacy API verification failed:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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

    if (!SERVICE_ROLE_KEY) {
      console.error('Missing SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error', message: 'Missing SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const receiptData =
      body?.receiptData ??
      body?.purchaseToken ??
      body?.receipt ??
      body?.transactionReceipt ??
      null;
    const transactionId = body?.transactionId ?? null;
    const productId = body?.productId ?? null;

    console.log('[Verify] Incoming request:', {
      hasReceiptData: Boolean(receiptData),
      hasTransactionId: Boolean(transactionId),
      productId,
      bundleId: APP_STORE_BUNDLE_ID,
      hasKeyId: Boolean(APP_STORE_KEY_ID),
      hasIssuerId: Boolean(APP_STORE_ISSUER_ID),
      hasPrivateKey: Boolean(APP_STORE_PRIVATE_KEY),
    });

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'Missing productId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 獲取產品映射
    let productMap: Record<string, { tokens: number; bonus: number }> = {};
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch from system_config
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'recharge_amounts')
      .single();

    if (!configError && configData?.value) {
      try {
        const amounts = configData.value as any[];
        productMap = amounts.reduce((acc: any, curr: any) => {
          let pid = '';
          if (curr.id === 1) pid = 'token_pack_30';
          if (curr.id === 2) pid = 'token_pack_150';
          if (curr.id === 3) pid = 'token_pack_290';
          if (curr.id === 4) pid = 'token_pack_790';

          if (pid) {
            acc[pid] = { tokens: curr.tokens, bonus: curr.bonus };
          }
          return acc;
        }, {});
        console.log('[Verify] Loaded product map from DB:', productMap);
      } catch (e) {
        console.error('[Verify] Failed to parse DB config:', e);
      }
    }

    // Fallback if DB empty or parse failed
    if (Object.keys(productMap).length === 0) {
      console.warn('[Verify] Using hardcoded fallback map');
      productMap = {
        token_pack_30: { tokens: 100, bonus: 0 },
        token_pack_150: { tokens: 600, bonus: 0 },
        token_pack_290: { tokens: 1300, bonus: 0 },
        token_pack_790: { tokens: 4000, bonus: 0 },
      };
    }

    const productInfo = productMap[productId];
    if (!productInfo) {
      return new Response(
        JSON.stringify({ error: 'Invalid product ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 驗證購買：優先使用 App Store Server API（transactionId），fallback 到舊版 API（receiptData）
    let verificationResult: { valid: boolean; error?: string; status?: number };

    if (transactionId && !receiptData) {
      // 方法 1：使用 App Store Server API（完整版本 - Apple 推薦）
      console.log('[Verify] Using App Store Server API with transactionId:', transactionId);
      verificationResult = await verifyTransactionWithServerAPI(transactionId, productId);
    } else if (receiptData) {
      // 方法 2：使用舊版 VerifyReceipt API（fallback）
      console.log('[Verify] Using legacy VerifyReceipt API with receiptData');
      verificationResult = await verifyReceiptWithLegacyAPI(receiptData);
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing receiptData or transactionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!verificationResult.valid) {
      console.error('[Verify] Purchase verification failed:', {
        productId,
        hasTransactionId: Boolean(transactionId),
        hasReceiptData: Boolean(receiptData),
        details: verificationResult.error,
        status: verificationResult.status,
      });
      return new Response(
        JSON.stringify({
          error: 'Purchase verification failed',
          details: verificationResult.error,
          status: verificationResult.status,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 檢查是否已經處理過這個購買（防止重複發放）
    const transactionIdentifier = transactionId || `product_${productId}_${Date.now()}`;
    const { data: existingTransaction } = await supabaseAdmin
      .from('token_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('transaction_type', 'deposit')
      .eq('description', `App Store 購買 - ${productId}${transactionId ? ` (${transactionId})` : ''}`)
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
        JSON.stringify({ error: 'Failed to add tokens', details: tokenError, message: tokenError.message }),
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
        description: `App Store 購買 - ${productId}${transactionId ? ` (${transactionId})` : ''}`,
      });

    if (transactionError) {
      console.error('Error recording transaction:', transactionError);
      // 不返回錯誤，因為代幣已經發放
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokens: totalTokens,
        message: 'Purchase verified and tokens added',
        verificationMethod: transactionId ? 'App Store Server API' : 'Legacy VerifyReceipt API',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verify App Store purchase error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
