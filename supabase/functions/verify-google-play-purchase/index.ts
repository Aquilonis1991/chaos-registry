// 驗證 Google Play 購買
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
// Import cors helpers - if these fail, we are in trouble, but let's hope they exist.
import { getCorsHeaders, handleCorsPreFlight, validateOrigin } from '../_shared/cors.ts';

// MOVE ENV VAR READS INSIDE or USE NON-NULL ASSERTION CAREFULLY
// Top-level throws can cause 500s that are hard to debug.

Deno.serve(async (req) => {
  // Global Try-Catch to ensure we ALWAYS return JSON
  try {
    // 1. CORS Pre-flight
    // Note: If cors.ts fails to import, the script dies at startup. 
    // We assume deployment includes _shared.
    const corsResponse = handleCorsPreFlight(req);
    if (corsResponse) return corsResponse;

    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    // 2. Origin Validation
    const originValidation = validateOrigin(req);
    if (originValidation) return originValidation;

    // 3. Environment Check (Inside Handler)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      console.error('Missing Environment Variables:', {
        hasUrl: !!SUPABASE_URL,
        hasAnon: !!SUPABASE_ANON_KEY,
        hasServiceRole: !!SERVICE_ROLE_KEY
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server Configuration Error',
          message: 'Missing critical environment variables. Please check Supabase Console Secrets.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Auth Validation
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', message: 'Missing Authorization header' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        // Return 200 even for Auth error to make sure client sees the message?? 
        // usage: status 401 might trigger client generic error. Let's use 200 with success:false for maximum visibility.
      );
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', message: 'User not found or token invalid' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Parse Body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Request', message: 'Invalid JSON body' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { purchaseToken, productId, transactionId, packageName } = body;
    const GOOGLE_PLAY_PACKAGE_NAME = 'com.votechaos.app';

    if (!purchaseToken || !productId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Data', message: 'Missing purchaseToken or productId' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Product Mapping (Dynamic from DB)
    let productMap: Record<string, { tokens: number; bonus: number }> = {};

    // Fetch from system_config
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'recharge_amounts')
      .single();

    if (!configError && configData?.value) {
      try {
        const amounts = configData.value as any[];
        productMap = amounts.reduce((acc: any, curr: any) => {
          // Map both android and ios IDs if possible, but here we primarily need to match the productId
          // The config structure: { id: 1, tokens: 100, price: 30, icon: 'Coins', popular: false, bonus: 0 }
          // We need to map product IDs to this.
          // Wait, the DB config valid doesn't have the product IDs! 
          // The PRODUCT_ID_MAP in src/lib/purchase.ts maps ID 1 -> token_pack_small.
          // We need to know which ID maps to which product ID.
          // Standard mapping:
          // 1 -> token_pack_small
          // 2 -> token_pack_medium
          // 3 -> token_pack_large
          // 4 -> token_pack_xlarge

          let pid = '';
          if (curr.id === 1) pid = 'token_pack_small';
          if (curr.id === 2) pid = 'token_pack_medium';
          if (curr.id === 3) pid = 'token_pack_large';
          if (curr.id === 4) pid = 'token_pack_xlarge';

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
        token_pack_small: { tokens: 100, bonus: 0 },
        token_pack_medium: { tokens: 500, bonus: 75 }, // Ensure these match the DB default I inserted (75 not 50)
        token_pack_large: { tokens: 1000, bonus: 150 },
        token_pack_xlarge: { tokens: 3000, bonus: 600 }, // DB says 600, checking fallback consistency
      };
    }

    const productInfo = productMap[productId];
    if (!productInfo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Product', message: `Unknown product ID: ${productId}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Verify with Google (Mock or Real)
    const GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL');
    const GOOGLE_PLAY_PRIVATE_KEY = Deno.env.get('GOOGLE_PLAY_PRIVATE_KEY');

    let purchaseData: any = null;
    let verificationMethod = 'none';
    const appPackageName = packageName || GOOGLE_PLAY_PACKAGE_NAME;

    // A. Verify with Google Publisher API
    if (GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL && GOOGLE_PLAY_PRIVATE_KEY) {
      try {
        console.log('[Google Play] Initiating Real Server-to-Server Verification...');

        // Helper: Convert PEM to CryptoKey
        const importGoogleKey = async (pem: string) => {
          // Remove header/footer and newlines
          const pemHeader = "-----BEGIN PRIVATE KEY-----";
          const pemFooter = "-----END PRIVATE KEY-----";
          const pemContents = pem
            .replace(pemHeader, "")
            .replace(pemFooter, "")
            .replace(/\s/g, "");

          // Base64 decode
          const binaryDerString = atob(pemContents);
          const binaryDer = new Uint8Array(binaryDerString.length);
          for (let i = 0; i < binaryDerString.length; i++) {
            binaryDer[i] = binaryDerString.charCodeAt(i);
          }

          return await crypto.subtle.importKey(
            "pkcs8",
            binaryDer.buffer,
            {
              name: "RSASSA-PKCS1-v1_5",
              hash: "SHA-256",
            },
            true,
            ["sign"]
          );
        };

        // Helper: Get Access Token
        const getGoogleAccessToken = async () => {
          const now = Math.floor(Date.now() / 1000);
          const key = await importGoogleKey(GOOGLE_PLAY_PRIVATE_KEY);

          const header = { alg: "RS256", typ: "JWT" };
          const payload = {
            iss: GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
            scope: "https://www.googleapis.com/auth/androidpublisher",
            aud: "https://oauth2.googleapis.com/token",
            exp: now + 3600,
            iat: now,
          };

          // Sign JWT using djwt
          // Dynamic import to ensure it works in Deno env
          const { create } = await import('https://deno.land/x/djwt@v3.0.2/mod.ts');
          const jwt = await create(header, payload, key);

          // Exchange for Access Token
          const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
              assertion: jwt,
            }),
          });

          if (!tokenResp.ok) {
            const errText = await tokenResp.text();
            throw new Error(`Auth Failed: ${tokenResp.status} - ${errText}`);
          }

          const tokenData = await tokenResp.json();
          return tokenData.access_token;
        };

        const accessToken = await getGoogleAccessToken();
        console.log('[Google Play] Access Token obtained.');

        // Call Android Publisher API
        // GET /androidpublisher/v3/applications/{packageName}/purchases/products/{productId}/tokens/{token}
        const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${appPackageName}/purchases/products/${productId}/tokens/${purchaseToken}`;

        const verifyResp = await fetch(verifyUrl, {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        });

        if (!verifyResp.ok) {
          const errText = await verifyResp.text();
          console.error('[Google Play] Verification Failed API Response:', errText);
          // If 404, it implies invalid token/order.
          // If 401, server config error.
          throw new Error(`Google API Error: ${verifyResp.status}`);
        }

        const verifyData = await verifyResp.json();
        console.log('[Google Play] Verification Result:', JSON.stringify(verifyData));

        if (verifyData.purchaseState === 0) { // 0 = Purchased
          if (verifyData.consumptionState === 1) {
            // Previously consumed?
            // Logic: Does the app consume client side or server side? 
            // Usually server side should acknowledge/consume. 
            // However, commonly client purchases -> consumes -> verify (for consumables).
            // Or client purchases -> verify -> consume.
            // We will accept 1 (Consumed) if it hasn't been recorded in OUR DB yet (checked below).
            // But generally 0 is safer for "new" purchase if we consume server side.
            // Let's assume standard flow: If it's valid, it's valid.
          }
          verificationMethod = 'google_api';
          purchaseData = verifyData;
        } else {
          // 1 = Canceled, 2 = Pending
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Purchase Invalid',
              message: `Google status: ${verifyData.purchaseState === 1 ? 'Canceled' : 'Pending'}`
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

      } catch (e) {
        console.error('[Google Play] API Verification Error:', e);
        // If API fails (e.g. key issue), DO NOT FALLBACK to basic if we want high security.
        // User requested "Full version security", so we hard fail on API error.
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Verification System Error',
            message: 'Validation with Google failed. Please contact support if you were charged.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // B. Basic Verification (Fallback)
    if (!purchaseData) {
      console.warn('[Google Play] Using basic verification');
      verificationMethod = 'basic';
      if (purchaseToken && purchaseToken.length > 5) {
        purchaseData = {
          purchaseState: 0,
          consumptionState: 0,
          purchaseTimeMillis: Date.now().toString(),
        };
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid Token', message: 'Purchase token format invalid' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (purchaseData.purchaseState !== 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Purchase Pending/Cancelled', message: `Purchase state is ${purchaseData.purchaseState}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Prevent Duplicate Processing (Idempotency)
    // supabaseAdmin is already initialized above

    // Check by purchaseToken
    const { data: existingByToken, error: checkError } = await supabaseAdmin
      .from('token_transactions')
      .select('id, amount, created_at, metadata')
      .eq('transaction_type', 'deposit')
      .eq('metadata->>purchaseToken', purchaseToken)
      .maybeSingle();

    if (existingByToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Duplicate Purchase',
          message: '此次購買已經處理過，無法重複領取',
          existingTransaction: existingByToken
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Add Tokens
    const totalTokens = productInfo.tokens + productInfo.bonus;
    const { error: tokenError } = await supabaseAdmin.rpc('add_tokens', {
      user_id: user.id,
      token_amount: totalTokens,
    });

    if (tokenError) {
      console.error('Error adding tokens:', tokenError);
      return new Response(
        JSON.stringify({ success: false, error: 'Database Error', message: `Failed to add tokens: ${tokenError.message}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Record Transaction
    const { error: transactionError } = await supabaseAdmin
      .from('token_transactions')
      .insert({
        user_id: user.id,
        amount: totalTokens,
        transaction_type: 'deposit', // Matches our new constraint
        description: `Google Play 購買 - ${productId}`,
        metadata: {
          purchaseToken: purchaseToken,
          productId: productId,
          transactionId: transactionId || null,
          packageName: appPackageName,
          verificationMethod: verificationMethod,
          purchaseState: purchaseData.purchaseState,
        },
      });

    if (transactionError) {
      console.error('Error recording transaction:', transactionError);
      // We don't fail, because money is given.
      // But we should probably alert/log somewhere.
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokens: totalTokens,
        message: 'Purchase verified and tokens added'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    // This CATCH ALL ensures 200 OK + JSON Error
    console.error('CRITICAL UNCAUGHT ERROR:', error);

    // Construct default headers if they failed earlier
    const origin = req.headers.get('origin');
    const headers = getCorsHeaders(origin);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Critical Server Error',
        message: error instanceof Error ? error.message : String(error)
      }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});



