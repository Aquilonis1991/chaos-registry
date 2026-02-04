import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { getCorsHeaders, handleCorsPreFlight, validateOrigin } from '../_shared/cors.ts';

// Debug wrapper
Deno.serve(async (req) => {
    // 0. Handle CORS Pre-flight immediately
    if (req.method === 'OPTIONS') {
        const origin = req.headers.get('origin');
        return new Response(null, { headers: getCorsHeaders(origin), status: 204 });
    }

    try {
        const origin = req.headers.get('origin');
        const corsHeaders = getCorsHeaders(origin);

        // 1. Log Request
        console.log(`[Edge] Request received: ${req.method} ${req.url}`);

        // 2. Env Vars Check
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
        const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
            console.error('[Edge] Missing Env Vars:', {
                hasUrl: !!SUPABASE_URL,
                hasAnon: !!SUPABASE_ANON_KEY,
                hasService: !!SERVICE_ROLE_KEY
            });
            throw new Error(`Server Configuration Error: Missing Env Vars. URL:${!!SUPABASE_URL}, Anon:${!!SUPABASE_ANON_KEY}, Service:${!!SERVICE_ROLE_KEY}`);
        }

        // 3. Parse Body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            throw new Error('Invalid JSON Body');
        }
        const { action, email, password, deviceId, platform } = body;
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

        console.log(`[Edge] Action: ${action}, IP: ${clientIp}`);

        // 4. Init Clients
        const adminClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
        const authClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

        // 5. Logic
        if (action === 'health_check') {
            return new Response(JSON.stringify({ success: true, message: 'Service Operational' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (action === 'login') {
            const identifier = email?.trim().toLowerCase();
            if (!identifier) throw new Error('Email is required');

            // [CHECK] Is blocked?
            const { data: limitInfo, error: limitError } = await adminClient
                .from('security_rate_limits')
                .select('*')
                .eq('identifier', identifier)
                .eq('action_type', 'login')
                .single();

            if (limitError && limitError.code !== 'PGRST116') { // PGRST116 is "Row not found" (0 results), which is fine
                console.error('[Edge] DB Error (Check Blocked):', limitError);
                // Don't crash, just proceed or warn? For security, maybe fail open or closed. Let's fail safe (allow) but log, or if table missing throw.
                if (limitError.message?.includes('does not exist')) throw new Error('DB Table security_rate_limits missing');
            }

            if (limitInfo && limitInfo.blocked_until) {
                const blockedUntil = new Date(limitInfo.blocked_until);
                if (blockedUntil > new Date()) {
                    const waitMinutes = Math.ceil((blockedUntil.getTime() - new Date().getTime()) / 60000);
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: 'RateLimitExceeded',
                            message: `嘗試次數過多，請於 ${waitMinutes} 分鐘後再試。`
                        }),
                        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            }

            // [EXECUTE] Auth
            const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
                email: identifier,
                password: password
            });

            if (authError) {
                // [FAIL] Increment count & Block if needed
                let newCount = (limitInfo?.attempt_count || 0) + 1;
                let blockedUntil = null;

                if (newCount >= 5) {
                    blockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins
                }

                const upsertData = {
                    identifier: identifier,
                    action_type: 'login',
                    ip_address: clientIp,
                    attempt_count: newCount,
                    last_attempt_at: new Date().toISOString(),
                    blocked_until: blockedUntil
                };

                // Update DB
                const { error: upsertError } = await adminClient.from('security_rate_limits').upsert(upsertData, { onConflict: 'id' }); // Actually our logical key is identifier+action_type but we don't have unique constraint on them yet in definition, relying on ID is tricky if we don't know ID.
                // Revised Logic: We query by identifier+action. If exists, we have ID. If not, insert.
                if (limitInfo?.id) {
                    await adminClient.from('security_rate_limits').update(upsertData).eq('id', limitInfo.id);
                } else {
                    await adminClient.from('security_rate_limits').insert(upsertData);
                }

                const remaining = Math.max(0, 5 - newCount);
                const msg = blockedUntil
                    ? '嘗試次數過多，帳號已暫時鎖定 15 分鐘。'
                    : `帳號或密碼錯誤。剩餘嘗試次數：${remaining}`;

                return new Response(
                    JSON.stringify({ success: false, error: 'AuthFailed', message: msg }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // [SUCCESS] Reset count
            if (limitInfo && limitInfo.id) {
                await adminClient.from('security_rate_limits')
                    .update({ attempt_count: 0, blocked_until: null, last_attempt_at: new Date().toISOString() })
                    .eq('id', limitInfo.id);
            }

            return new Response(
                JSON.stringify({ success: true, data: authData }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );

        }

        else if (action === 'signup_request') {
            const targetDevice = deviceId || clientIp;

            // [CHECK 1] Cooldown (60s) for Device/IP
            const { data: interactions, error: iterError } = await adminClient
                .from('security_rate_limits')
                .select('*')
                .eq('identifier', targetDevice)
                .eq('action_type', 'signup_email')
                .order('last_attempt_at', { ascending: false })
                .limit(1)
                .single();

            if (interactions) {
                const lastTime = new Date(interactions.last_attempt_at).getTime();
                const now = Date.now();
                if (now - lastTime < 60000) { // 60s
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: 'Cooldown',
                            message: '請等待 60 秒後再重新註冊或發送驗證信。'
                        }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            }

            // [CHECK 2] IP Rate Limit
            const { data: ipLimit } = await adminClient
                .from('security_rate_limits')
                .select('*')
                .eq('identifier', clientIp)
                .eq('action_type', 'signup_ip_limit')
                .single();

            if (ipLimit) {
                const last = new Date(ipLimit.last_attempt_at).getTime();
                if (Date.now() - last > 3600000) { // Reset after 1h
                    await adminClient.from('security_rate_limits').update({ attempt_count: 0 }).eq('id', ipLimit.id);
                } else if (ipLimit.attempt_count >= 10) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: 'IPLimitExceeded',
                            message: '此 IP 註冊次數過多，請稍後再試。'
                        }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            }

            // [EXECUTE] Auth SignUp
            const { data: authData, error: authError } = await authClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: platform === 'web' ? undefined : 'votechaos://auth/verify-redirect'
                }
            });

            if (authError) {
                // If the error seems to be "User already registered" (Supabase might return this depending on config), handle it.
                // Usually Supabase returns fake success or specific error.
                // We return 200 so the client can display the message.
                return new Response(
                    JSON.stringify({ success: false, error: 'SignupFailed', message: authError.message }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // [LOG] Update limits
            if (interactions) {
                await adminClient.from('security_rate_limits').update({ last_attempt_at: new Date().toISOString() }).eq('id', interactions.id);
            } else {
                await adminClient.from('security_rate_limits').insert({ identifier: targetDevice, action_type: 'signup_email', last_attempt_at: new Date().toISOString() });
            }

            if (ipLimit) {
                await adminClient.from('security_rate_limits').update({ attempt_count: (ipLimit.attempt_count || 0) + 1, last_attempt_at: new Date().toISOString() }).eq('id', ipLimit.id);
            } else {
                await adminClient.from('security_rate_limits').insert({ identifier: clientIp, action_type: 'signup_ip_limit', attempt_count: 1 });
            }

            return new Response(
                JSON.stringify({ success: true, data: authData }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: false, error: 'InvalidAction', message: `Unknown action: ${action}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[Edge Critical] Error:', err);
        // Ensure we can get headers even on error
        let headers = { 'Content-Type': 'application/json' };
        try {
            const reqOrigin = req.headers.get('origin');
            headers = { ...headers, ...getCorsHeaders(reqOrigin) };
        } catch (e) { }

        return new Response(
            JSON.stringify({
                success: false,
                error: 'InternalError',
                message: err.message || 'Server Error',
                details: err.toString()
            }),
            { status: 500, headers: headers }
        );
    }
});
