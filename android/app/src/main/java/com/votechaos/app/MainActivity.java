package com.votechaos.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.votechaos.nativead.NativeAdPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "VoteChaos";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            Log.d(TAG, "MainActivity onCreate start");
            registerPlugin(NativeAdPlugin.class);
            super.onCreate(savedInstanceState);
            Log.d(TAG, "MainActivity onCreate complete");
        } catch (Exception e) {
            Log.e(TAG, "Fatal error in onCreate", e);
            Toast.makeText(this, "啟動失敗: " + e.getMessage(), Toast.LENGTH_LONG).show();
            throw e;
        }
    }
    
    @Override
    public void onStart() {
        try {
            Log.d(TAG, "MainActivity onStart");
            super.onStart();
            configureWebViewClient();
        } catch (Exception e) {
            Log.e(TAG, "Error in onStart", e);
            throw e;
        }
    }
    
    @Override
    public void onResume() {
        try {
            Log.d(TAG, "MainActivity onResume");
            super.onResume();
            // 延遲配置，確保 Bridge 完全初始化
            android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
            handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    configureWebViewClient();
                }
            }, 500);
        } catch (Exception e) {
            Log.e(TAG, "Error in onResume", e);
            throw e;
        }
    }
    
    /**
     * 配置 WebViewClient，委託 shouldInterceptRequest 給 Capacitor 的 WebViewLocalServer
     * 這是修復 ERR_CONNECTION_REFUSED 的關鍵修復
     */
    private void configureWebViewClient() {
        try {
            Bridge bridge = this.getBridge();
            if (bridge != null) {
                WebView webView = bridge.getWebView();
                if (webView != null) {
                            // 防止 WebView 打開新分頁或新窗口
                            webView.getSettings().setSupportMultipleWindows(false);
                            webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
                            
                            // 確保所有 URL 都在當前 WebView 中打開，而不是外部瀏覽器
                            // 這對於 OAuth 流程很重要，因為需要攔截回調 URL

                            // 設置 WebChromeClient 來處理 onCreateWindow 事件，防止打開新窗口
                            webView.setWebChromeClient(new WebChromeClient() {
                                @Override
                                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                                    // 阻止創建新窗口，在當前 WebView 中打開
                                    WebView.HitTestResult result = view.getHitTestResult();
                                    String data = result.getExtra();
                                    if (data != null) {
                                        Log.d(TAG, "onCreateWindow intercepted, opening in current WebView: " + data);
                                        view.loadUrl(data);
                                    } else {
                                        // 如果沒有 data，嘗試從 resultMsg 中獲取 URL
                                        Log.d(TAG, "onCreateWindow intercepted but no data, preventing new window");
                                    }
                                    return true; // 已處理，不創建新窗口
                                }
                            });
                    
                    // 保存原有的 WebViewClient（Capacitor 的 BridgeWebViewClient）
                    WebViewClient existingWebViewClient = webView.getWebViewClient();
                    
                    // 創建新的 WebViewClient，委託 shouldInterceptRequest 並處理 Deep Link
                    webView.setWebViewClient(new WebViewClient() {
                        // 委託 shouldInterceptRequest 給原有的 WebViewClient（Capacitor 的 BridgeWebViewClient）
                        // 這對於 WebViewLocalServer 攔截本地資源請求至關重要
                        @Override
                        public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                            if (existingWebViewClient != null) {
                                return existingWebViewClient.shouldInterceptRequest(view, request);
                            }
                            return super.shouldInterceptRequest(view, request);
                        }
                        
                        @Override
                        @SuppressWarnings("deprecation")
                        public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                            if (existingWebViewClient != null) {
                                return existingWebViewClient.shouldInterceptRequest(view, url);
                            }
                            return super.shouldInterceptRequest(view, url);
                        }
                        
                        // 當頁面載入完成時，檢查是否為 Edge Function callback URL
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            if (existingWebViewClient != null) {
                                existingWebViewClient.onPageFinished(view, url);
                            }
                            
                            // 檢查是否為 Edge Function callback URL（即使沒有 code 和 state，也可能載入了 HTML 頁面）
                            if (url != null && (url.contains("supabase.co/functions/v1/twitter-auth/callback") ||
                                url.contains("supabase.co/functions/v1/line-auth/callback"))) {
                                Log.d(TAG, "Edge Function callback page loaded: " + url);
                                
                                try {
                                    Uri uri = Uri.parse(url);
                                    String code = uri.getQueryParameter("code");
                                    String state = uri.getQueryParameter("state");
                                    
                                    if (code != null && state != null) {
                                        Log.d(TAG, "Extracting code and state from callback URL in onPageFinished");
                                        handleOAuthCallback(view, code, state, url);
                                    } else {
                                        // 如果沒有 code 和 state，可能是錯誤頁面，嘗試從 JavaScript 中提取
                                        Log.d(TAG, "No code/state in URL, attempting to extract from page content");
                                        extractFromPageContent(view, url);
                                    }
                                } catch (Exception e) {
                                    Log.e(TAG, "Error in onPageFinished callback handling", e);
                                }
                            }
                        }
                        
                        // 從頁面內容中提取 Deep Link（如果 Edge Function 返回了 HTML 頁面）
                        private void extractFromPageContent(WebView view, String url) {
                            Log.d(TAG, "Attempting to extract Deep Link from page content");
                            
                            // 創建 JavaScript 接口對象（只創建一次）
                            final Object jsInterface = new Object() {
                                @android.webkit.JavascriptInterface
                                public void handleDeepLink(String deepLinkUrl) {
                                    android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
                                    mainHandler.post(new Runnable() {
                                        @Override
                                        public void run() {
                                            Log.d(TAG, "JavaScript extracted Deep Link: " + deepLinkUrl);
                                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLinkUrl));
                                            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                                            try {
                                                view.getContext().startActivity(intent);
                                                Log.d(TAG, "Deep Link Intent started from JavaScript extraction");
                                            } catch (Exception e) {
                                                Log.e(TAG, "Failed to start Deep Link Intent from JavaScript", e);
                                            }
                                        }
                                    });
                                }
                            };
                            
                            // 添加 JavaScript 接口（如果尚未添加）
                            try {
                                view.addJavascriptInterface(jsInterface, "AndroidCallbackHandler");
                                Log.d(TAG, "JavaScript interface added");
                            } catch (Exception e) {
                                Log.w(TAG, "JavaScript interface may already exist", e);
                            }
                            
                            // 注入 JavaScript 來提取 Deep Link
                            String jsCode = 
                                "(function() {" +
                                "  try {" +
                                "    // 方法 1: 從 console.log 中提取" +
                                "    var scripts = document.getElementsByTagName('script');" +
                                "    for (var i = 0; i < scripts.length; i++) {" +
                                "      var script = scripts[i].innerHTML;" +
                                "      var match = script.match(/votechaos:\\/\\/auth\\/callback[^'\"\\s)]+/);" +
                                "      if (match && match[0]) {" +
                                "        console.log('[Android] Found Deep Link in script:', match[0]);" +
                                "        if (window.AndroidCallbackHandler) {" +
                                "          window.AndroidCallbackHandler.handleDeepLink(match[0]);" +
                                "          return;" +
                                "        }" +
                                "      }" +
                                "    }" +
                                "    " +
                                "    // 方法 2: 從 <a> 標籤中提取" +
                                "    var links = document.getElementsByTagName('a');" +
                                "    for (var i = 0; i < links.length; i++) {" +
                                "      var href = links[i].getAttribute('href');" +
                                "      if (href && href.indexOf('votechaos://') === 0) {" +
                                "        console.log('[Android] Found Deep Link in link:', href);" +
                                "        if (window.AndroidCallbackHandler) {" +
                                "          window.AndroidCallbackHandler.handleDeepLink(href);" +
                                "          return;" +
                                "        }" +
                                "      }" +
                                "    }" +
                                "    " +
                                "    // 方法 3: 直接觸發頁面中的 redirect 函數" +
                                "    if (typeof redirect === 'function') {" +
                                "      console.log('[Android] Calling redirect function');" +
                                "      redirect();" +
                                "    }" +
                                "  } catch (e) {" +
                                "    console.error('[Android] Error extracting Deep Link:', e);" +
                                "  }" +
                                "})();";
                            
                            // 執行 JavaScript（延遲以確保頁面完全載入）
                            view.postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    view.evaluateJavascript(jsCode, new android.webkit.ValueCallback<String>() {
                                        @Override
                                        public void onReceiveValue(String value) {
                                            Log.d(TAG, "JavaScript evaluation result: " + value);
                                        }
                                    });
                                }
                            }, 1000); // 增加延遲到 1 秒，確保頁面完全載入
                        }
                        
                        // 處理 OAuth callback
                        private void handleOAuthCallback(WebView view, String code, String state, String url) {
                            Log.d(TAG, "OAuth callback detected (code and state present)");
                            Log.d(TAG, "Constructing Deep Link to trigger OAuthCallbackHandler");
                            
                            // 判斷 provider（從 URL 或 state 中）
                            String provider = "twitter";
                            if (url.contains("line-auth")) {
                                provider = "line";
                            }
                            
                            // 直接構建 Deep Link，觸發 OAuthCallbackHandler 處理
                            String deepLinkUrl = String.format(
                                "votechaos://auth/callback?code=%s&state=%s&provider=%s&platform=app",
                                Uri.encode(code),
                                Uri.encode(state),
                                provider
                            );
                            
                            Log.d(TAG, "Triggering Deep Link: " + deepLinkUrl);
                            
                            // 觸發 Deep Link Intent
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLinkUrl));
                            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                            try {
                                view.getContext().startActivity(intent);
                                Log.d(TAG, "Deep Link Intent started successfully");
                            } catch (Exception e) {
                                Log.e(TAG, "Failed to start Deep Link Intent", e);
                            }
                        }
                        
                        // 處理 URL 載入（包括 Deep Link 和 magic link）
                        private boolean handleUrl(WebView view, String url) {
                            if (url == null) {
                                return false;
                            }
                            
                            Log.d(TAG, "WebView shouldOverrideUrlLoading: " + url);
                            
                            // 處理 Deep Link（votechaos://）
                            if (url.startsWith("votechaos://")) {
                                Log.d(TAG, "Deep Link detected: " + url);
                                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                                try {
                                    view.getContext().startActivity(intent);
                                    Log.d(TAG, "Deep Link Intent started successfully");
                                    return true; // 已處理，不讓 WebView 載入
                                } catch (Exception e) {
                                    Log.e(TAG, "Failed to start Deep Link Intent", e);
                                    return false; // 處理失敗，讓 WebView 正常處理
                                }
                            }
                            
                            // 記錄所有包含 /auth/callback 的 URL（用於調試）
                            if (url.contains("/auth/callback")) {
                                Log.d(TAG, "Potential OAuth callback URL detected: " + url);
                            }
                            
                            // 修復：處理 Supabase callback URL、Edge Function callback URL 和前端 callback URL
                            // 檢測是否包含 code 和 state（Twitter/LINE 登入回調）
                            // 如果包含這些參數，直接構建 Deep Link 並觸發，讓 OAuthCallbackHandler 處理
                            boolean isOAuthCallback = url.contains("supabase.co/auth/v1/callback") || 
                                url.contains("supabase.co/functions/v1/twitter-auth/callback") ||
                                url.contains("supabase.co/functions/v1/line-auth/callback") ||
                                (url.contains("/auth/callback") && (url.contains("provider=") || url.contains("code=")));
                            
                            if (isOAuthCallback) {
                                Log.d(TAG, "OAuth callback URL detected in shouldOverrideUrlLoading: " + url);
                                
                                // 檢查是否包含 code 和 state 參數（Twitter/LINE 登入回調）
                                try {
                                    Uri uri = Uri.parse(url);
                                    String code = uri.getQueryParameter("code");
                                    String state = uri.getQueryParameter("state");
                                    String error = uri.getQueryParameter("error");
                                    
                                    Log.d(TAG, "OAuth callback parameters - code: " + (code != null ? "present" : "null") + 
                                        ", state: " + (state != null ? "present" : "null") + 
                                        ", error: " + (error != null ? error : "null"));
                                    
                                    // 如果有錯誤，直接轉發錯誤 Deep Link
                                    if (error != null) {
                                        Log.d(TAG, "OAuth callback has error, forwarding error Deep Link");
                                        String errorDescription = uri.getQueryParameter("error_description");
                                        String deepLinkUrl = "votechaos://auth/callback?error=" + Uri.encode(error);
                                        if (errorDescription != null) {
                                            deepLinkUrl += "&error_description=" + Uri.encode(errorDescription);
                                        }
                                        
                                        Log.d(TAG, "Triggering error Deep Link: " + deepLinkUrl);
                                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLinkUrl));
                                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                                        try {
                                            view.getContext().startActivity(intent);
                                            Log.d(TAG, "Error Deep Link Intent started successfully");
                                            return true;
                                        } catch (Exception e) {
                                            Log.e(TAG, "Failed to start error Deep Link Intent", e);
                                            return false;
                                        }
                                    }
                                    
                                    if (code != null && state != null) {
                                        Log.d(TAG, "OAuth callback detected (code and state present)");
                                        
                                        // 判斷 provider（從 URL 參數、URL 路徑或 state 中）
                                        String provider = uri.getQueryParameter("provider");
                                        if (provider == null || provider.isEmpty()) {
                                            // 如果 URL 參數中沒有 provider，從 URL 路徑判斷
                                            if (url.contains("line-auth") || url.contains("provider=line")) {
                                                provider = "line";
                                            } else if (url.contains("twitter-auth") || url.contains("provider=twitter") || url.contains("provider=x")) {
                                                provider = "x"; // Twitter 現在使用 'x' 作為 provider 名稱
                                            } else {
                                                provider = "line"; // 默認使用 line
                                            }
                                        }
                                        
                                        // 直接構建 Deep Link，觸發 OAuthCallbackHandler 處理
                                        String deepLinkUrl = String.format(
                                            "votechaos://auth/callback?code=%s&state=%s&provider=%s&platform=app",
                                            Uri.encode(code),
                                            Uri.encode(state),
                                            provider
                                        );
                                        
                                        Log.d(TAG, "Triggering Deep Link: " + deepLinkUrl);
                                        
                                        // 觸發 Deep Link Intent
                                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLinkUrl));
                                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                                        try {
                                            view.getContext().startActivity(intent);
                                            Log.d(TAG, "Deep Link Intent started successfully");
                                            // 攔截這個請求，不讓 WebView 載入 callback URL
                                            return true;
                                        } catch (Exception e) {
                                            Log.e(TAG, "Failed to start Deep Link Intent", e);
                                            // 如果 Deep Link 失敗，讓 WebView 正常處理（onPageFinished 會處理）
                                            return false;
                                        }
                                    } else {
                                        // 如果沒有 code 和 state，讓 WebView 載入，onPageFinished 會處理
                                        Log.d(TAG, "No code/state in URL, allowing WebView to load (onPageFinished will handle)");
                                        return false;
                                    }
                                } catch (Exception e) {
                                    Log.e(TAG, "Failed to parse OAuth callback URL", e);
                                    // 讓 WebView 正常處理
                                    return false;
                                }
                            }
                            
                            // 處理 magic link（包含 redirect_to=votechaos://）
                            // 注意：不要直接打開 Deep Link，讓 Supabase 先驗證 magic link
                            // Supabase 驗證後會重定向到包含 tokens 的 Deep Link
                            if (url.contains("redirect_to=") || url.contains("redirect_to%3D")) {
                                try {
                                    Uri uri = Uri.parse(url);
                                    String redirectTo = uri.getQueryParameter("redirect_to");
                                    
                                    // 如果 redirect_to 是 URL 編碼的，解碼它
                                    if (redirectTo != null && redirectTo.contains("%3A%2F%2F")) {
                                        redirectTo = java.net.URLDecoder.decode(redirectTo, "UTF-8");
                                    }
                                    
                                    Log.d(TAG, "Parsed redirect_to from magic link: " + redirectTo);
                                    
                                    // 如果 redirect_to 是 Deep Link，讓 WebView 正常載入 magic link
                                    // Supabase 會驗證 magic link 並重定向到包含 tokens 的 Deep Link
                                    if (redirectTo != null && redirectTo.startsWith("votechaos://")) {
                                        Log.d(TAG, "Magic link with Deep Link detected, allowing WebView to load magic link for verification");
                                        Log.d(TAG, "Supabase will verify the magic link and redirect to Deep Link with tokens");
                                        // 不攔截，讓 WebView 正常載入 magic link
                                        return false;
                                    }
                                } catch (Exception e) {
                                    Log.e(TAG, "Failed to parse magic link URL", e);
                                }
                            }
                            
                            // 其他 URL 讓原有 WebViewClient 處理
                            return false;
                        }
                        
                        @Override
                        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                            String url = request.getUrl().toString();
                            boolean handled = handleUrl(view, url);
                            
                            if (handled) {
                                return true; // 已處理 Deep Link
                            }
                            
                            // 其他 URL 委託給原有 WebViewClient
                            if (existingWebViewClient != null) {
                                return existingWebViewClient.shouldOverrideUrlLoading(view, request);
                            }
                            return super.shouldOverrideUrlLoading(view, request);
                        }
                        
                        @Override
                        @SuppressWarnings("deprecation")
                        public boolean shouldOverrideUrlLoading(WebView view, String url) {
                            boolean handled = handleUrl(view, url);
                            
                            if (handled) {
                                return true; // 已處理 Deep Link
                            }
                            
                            // 其他 URL 委託給原有 WebViewClient
                            if (existingWebViewClient != null) {
                                return existingWebViewClient.shouldOverrideUrlLoading(view, url);
                            }
                            return super.shouldOverrideUrlLoading(view, url);
                        }
                    });
                    
                    Log.d(TAG, "WebViewClient configured with shouldInterceptRequest delegation");
                } else {
                    Log.w(TAG, "WebView is null, cannot configure WebViewClient");
                }
            } else {
                Log.w(TAG, "Bridge is null, cannot configure WebViewClient");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error configuring WebViewClient", e);
        }
    }
}