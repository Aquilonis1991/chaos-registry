// 共享的 CORS 配置
// 所有 Edge Functions 都應使用此配置

// 允許的來源列表
export const ALLOWED_ORIGINS = [
  'https://epyykzxxglkjombvozhr.supabase.co', // Supabase 託管
  'capacitor://localhost', // Capacitor APP (iOS/Android)
  'https://localhost', // Capacitor (androidScheme/iosScheme = https) - ⚠️ 關鍵：必須包含此項
  'http://localhost', // Capacitor (androidScheme/iosScheme = http)
  'http://localhost:5173', // Vite 開發環境
  'http://localhost:8080', // Vite 開發環境 (替代 port)
  'http://localhost:3000', // 備用開發端口
  // 生產環境域名（上線後添加）
  'https://chaos-registry.vercel.app',
  'https://chaosregistry.com', // 正式自訂網域
  'https://www.chaosregistry.com', // 正式自訂網域（www）
];

/**
 * 檢查請求來源是否被允許
 * @param origin 請求來源
 * @returns 是否允許
 */
export const isOriginAllowed = (origin: string | null): boolean => {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
};

/**
 * 獲取 CORS 標頭
 * @param origin 請求來源
 * @returns CORS 標頭物件
 */
export const getCorsHeaders = (origin: string | null) => {
  // 如果來源被允許，使用該來源；否則檢查是否是前端應用
  let allowedOrigin: string;
  
  // ⚠️ 關鍵修復：優先處理 localhost（包括 https://localhost）
  if (origin && (origin.includes('localhost') || origin.includes('chaos-registry.vercel.app'))) {
    // 允許來自前端應用的請求（包括 https://localhost）
    allowedOrigin = origin;
  } else if (origin && isOriginAllowed(origin)) {
    allowedOrigin = origin;
  } else {
    // 使用第一個允許的來源作為默認值
    allowedOrigin = ALLOWED_ORIGINS[0];
  }
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 小時
  };
};

/**
 * 處理 CORS 預檢請求
 * @param req 請求物件
 * @returns 如果是 OPTIONS 請求，返回 Response；否則返回 null
 */
export const handleCorsPreFlight = (req: Request): Response | null => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, { 
      headers: getCorsHeaders(origin),
      status: 204
    });
  }
  return null;
};

/**
 * 檢查並驗證請求來源
 * @param req 請求物件
 * @returns 如果來源無效，返回 403 錯誤 Response；否則返回 null
 */
export const validateOrigin = (req: Request): Response | null => {
  const origin = req.headers.get('origin');
  
  // OPTIONS 請求跳過驗證（在 handleCorsPreFlight 處理）
  if (req.method === 'OPTIONS') {
    return null;
  }
  
  // 如果有 origin 且不在允許列表中
  if (origin && !isOriginAllowed(origin)) {
    // 即使來源無效，也要返回 CORS headers，以便瀏覽器能夠讀取錯誤訊息
    const corsHeaders = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({ error: 'Forbidden: Invalid origin' }), 
      { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
  
  return null;
};

/**
 * 獲取客戶端 IP 地址
 * @param req 請求物件
 * @returns IP 地址字串
 */
export const getClientIP = (req: Request): string => {
  // 嘗試多個標頭（依優先級）
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') || // Cloudflare
         req.headers.get('x-client-ip') ||
         'unknown';
};

/**
 * 獲取用戶代理
 * @param req 請求物件
 * @returns User-Agent 字串
 */
export const getUserAgent = (req: Request): string => {
  return req.headers.get('user-agent') || 'unknown';
};


