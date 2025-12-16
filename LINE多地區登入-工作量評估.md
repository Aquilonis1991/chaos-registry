# LINE 多地區登入 - 工作量評估與實作方案

> **目標**：實作根據用戶地區（台灣/日本）動態選擇 LINE Channel 的自訂 OAuth 流程  
> **評估日期**：2025-01-29  
> **複雜度**：⭐⭐⭐⭐（高）

---

## 📊 工作量總覽

| 項目 | 預估工時 | 難度 | 優先級 |
|------|---------|------|--------|
| **需求分析與設計** | 2-4 小時 | 中 | P0 |
| **環境變數與配置** | 1-2 小時 | 低 | P0 |
| **LINE OAuth 流程實作** | 8-12 小時 | 高 | P0 |
| **地區偵測邏輯** | 2-3 小時 | 中 | P0 |
| **錯誤處理與重試** | 2-4 小時 | 中 | P1 |
| **測試與除錯** | 4-6 小時 | 中 | P1 |
| **文件與維護** | 2-3 小時 | 低 | P2 |
| **總計** | **21-34 小時** | - | - |

**換算**：約 **3-5 個工作天**（假設每天 8 小時）

---

## 🔍 現有架構分析

### 當前實作方式

**檔案**：`src/pages/AuthPage.tsx`

```typescript
const handleSocialLogin = async (provider: 'line') => {
  await supabase.auth.signInWithOAuth({
    provider: 'line',
    options: {
      redirectTo: redirectUrl,
    },
  });
};
```

**優點**：
- ✅ 簡單，只需一行程式碼
- ✅ Supabase 自動處理 OAuth 流程
- ✅ 自動處理 token 交換和 session 設置
- ✅ 自動處理錯誤和重試

**缺點**：
- ❌ 無法動態選擇 Channel
- ❌ 只能使用 Supabase 設定的單一 Channel ID

---

## 🛠️ 需要實作的內容

### 1. 需求分析與設計（2-4 小時）

#### 1.1 功能需求
- [ ] 根據用戶語言/地區選擇 LINE Channel（台灣/日本）
- [ ] 支援 Web 版和 App 版（Deep Link）
- [ ] 處理 OAuth 授權流程
- [ ] 處理 OAuth 回調
- [ ] Token 交換和驗證
- [ ] 設置 Supabase session
- [ ] 錯誤處理和重試機制

#### 1.2 技術設計
- [ ] 選擇實作方式（直接調用 LINE API vs 使用 Supabase Edge Function）
- [ ] 設計地區偵測邏輯
- [ ] 設計錯誤處理流程
- [ ] 設計測試方案

**難點**：
- LINE OAuth 2.0 流程較複雜（授權碼模式）
- 需要處理 state 參數防止 CSRF 攻擊
- 需要處理 token 交換和驗證

---

### 2. 環境變數與配置（1-2 小時）

#### 2.1 新增環境變數

**檔案**：`.env.local` 或 `.env`

```env
# LINE Taiwan Channel
VITE_LINE_CHANNEL_ID_TW=1234567890
VITE_LINE_CHANNEL_SECRET_TW=your_taiwan_secret

# LINE Japan Channel
VITE_LINE_CHANNEL_ID_JP=0987654321
VITE_LINE_CHANNEL_SECRET_JP=your_japan_secret

# LINE OAuth Endpoints
VITE_LINE_AUTH_URL=https://access.line.me/oauth2/v2.1/authorize
VITE_LINE_TOKEN_URL=https://api.line.me/oauth2/v2.1/token
VITE_LINE_PROFILE_URL=https://api.line.me/v2/profile
```

#### 2.2 建立配置檔案

**檔案**：`src/config/lineConfig.ts`

```typescript
export const LINE_CONFIG = {
  taiwan: {
    channelId: import.meta.env.VITE_LINE_CHANNEL_ID_TW,
    channelSecret: import.meta.env.VITE_LINE_CHANNEL_SECRET_TW,
  },
  japan: {
    channelId: import.meta.env.VITE_LINE_CHANNEL_ID_JP,
    channelSecret: import.meta.env.VITE_LINE_CHANNEL_SECRET_JP,
  },
  endpoints: {
    authorize: 'https://access.line.me/oauth2/v2.1/authorize',
    token: 'https://api.line.me/oauth2/v2.1/token',
    profile: 'https://api.line.me/v2/profile',
    verify: 'https://api.line.me/oauth2/v2.1/verify',
  },
};
```

**工作量**：
- 設定環境變數：30 分鐘
- 建立配置檔案：30 分鐘
- 測試配置載入：30 分鐘

---

### 3. LINE OAuth 流程實作（8-12 小時）⭐ 最複雜

#### 3.1 OAuth 2.0 授權碼流程

LINE 使用標準的 OAuth 2.0 授權碼流程：

```
1. 用戶點擊 LINE 登入
   ↓
2. 重定向到 LINE 授權頁面（帶上 state、redirect_uri 等參數）
   ↓
3. 用戶授權後，LINE 重定向回 callback URL（帶上 code 和 state）
   ↓
4. 使用 code 交換 access_token 和 refresh_token
   ↓
5. 使用 access_token 取得用戶資訊
   ↓
6. 使用用戶資訊創建/更新 Supabase 用戶
   ↓
7. 設置 Supabase session
```

#### 3.2 需要實作的函數

**檔案**：`src/lib/lineOAuth.ts`（新建）

```typescript
// 1. 生成授權 URL（約 1-2 小時）
export const generateLineAuthUrl = (
  channelId: string,
  redirectUri: string,
  state: string
): string => {
  // 構建 LINE 授權 URL
  // 包含：response_type=code, client_id, redirect_uri, state, scope
};

// 2. 交換 Token（約 2-3 小時）
export const exchangeLineToken = async (
  code: string,
  channelId: string,
  channelSecret: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; id_token?: string }> => {
  // 調用 LINE Token API
  // 使用 Basic Auth（channelId:channelSecret base64）
  // 返回 access_token 和 refresh_token
};

// 3. 取得用戶資訊（約 1-2 小時）
export const getLineUserProfile = async (
  accessToken: string
): Promise<{ userId: string; displayName: string; pictureUrl?: string; email?: string }> => {
  // 調用 LINE Profile API
  // 使用 Bearer Token 認證
};

// 4. 驗證 ID Token（可選，約 2-3 小時）
export const verifyLineIdToken = async (
  idToken: string,
  channelId: string
): Promise<{ sub: string; email?: string; name?: string }> => {
  // 驗證 JWT ID Token
  // 檢查簽名、過期時間等
};

// 5. 創建/更新 Supabase 用戶（約 2-3 小時）
export const createOrUpdateSupabaseUser = async (
  lineUser: LineUserProfile,
  accessToken: string,
  refreshToken: string
): Promise<{ session: Session; user: User }> => {
  // 檢查用戶是否已存在（根據 email 或 provider_id）
  // 如果存在，更新用戶資訊
  // 如果不存在，創建新用戶
  // 設置 Supabase session
};
```

**工作量細分**：
- 研究 LINE OAuth API 文件：1-2 小時
- 實作授權 URL 生成：1-2 小時
- 實作 Token 交換：2-3 小時
- 實作用戶資訊取得：1-2 小時
- 實作 Supabase 用戶創建/更新：2-3 小時
- 整合測試：1-2 小時

**難點**：
- ⚠️ 需要處理 state 參數（防止 CSRF）
- ⚠️ 需要處理 token 過期和刷新
- ⚠️ 需要處理錯誤情況（用戶取消、網路錯誤等）
- ⚠️ 需要處理 ID Token 驗證（JWT 簽名驗證）

---

### 4. 地區偵測邏輯（2-3 小時）

#### 4.1 實作地區偵測

**檔案**：`src/lib/lineRegionDetector.ts`（新建）

```typescript
// 根據用戶語言或地區選擇 Channel
export const getLineChannel = (language: string): 'taiwan' | 'japan' => {
  // 方法 1：根據語言選擇
  if (language === 'ja' || language.startsWith('ja-')) {
    return 'japan';
  }
  return 'taiwan'; // 預設台灣
  
  // 方法 2：根據瀏覽器語言選擇
  // const browserLang = navigator.language;
  // if (browserLang.startsWith('ja')) return 'japan';
  // return 'taiwan';
  
  // 方法 3：根據 IP 地理位置（需要額外服務）
  // 使用 IP Geolocation API
};
```

#### 4.2 整合到 AuthPage

**檔案**：`src/pages/AuthPage.tsx`

```typescript
const handleLineLogin = async () => {
  // 1. 偵測地區
  const region = getLineChannel(language);
  const channelConfig = LINE_CONFIG[region];
  
  // 2. 生成 state（防止 CSRF）
  const state = generateState();
  localStorage.setItem('line_oauth_state', state);
  
  // 3. 生成授權 URL
  const redirectUri = isNative() 
    ? 'votechaos://auth/callback'
    : `${publicSiteUrl}/auth/verify-redirect`;
  
  const authUrl = generateLineAuthUrl(
    channelConfig.channelId,
    redirectUri,
    state
  );
  
  // 4. 重定向到 LINE 授權頁面
  window.location.href = authUrl;
};
```

**工作量細分**：
- 實作地區偵測邏輯：1 小時
- 整合到 AuthPage：1 小時
- 測試不同語言/地區：1 小時

---

### 5. OAuth 回調處理（3-4 小時）

#### 5.1 處理授權回調

**檔案**：`src/pages/VerifyRedirectPage.tsx` 或新建 `src/pages/LineCallbackPage.tsx`

```typescript
const LineCallbackPage = () => {
  useEffect(() => {
    const handleLineCallback = async () => {
      // 1. 從 URL 取得 code 和 state
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      
      // 2. 驗證 state（防止 CSRF）
      const savedState = localStorage.getItem('line_oauth_state');
      if (state !== savedState) {
        throw new Error('Invalid state parameter');
      }
      localStorage.removeItem('line_oauth_state');
      
      // 3. 如果有錯誤，顯示錯誤訊息
      if (error) {
        toast.error('LINE 登入失敗：' + error);
        navigate('/auth');
        return;
      }
      
      // 4. 偵測地區（需要保存到 localStorage 或從 state 中取得）
      const region = localStorage.getItem('line_oauth_region') || 'taiwan';
      const channelConfig = LINE_CONFIG[region];
      
      // 5. 交換 Token
      const tokens = await exchangeLineToken(
        code!,
        channelConfig.channelId,
        channelConfig.channelSecret,
        redirectUri
      );
      
      // 6. 取得用戶資訊
      const userProfile = await getLineUserProfile(tokens.access_token);
      
      // 7. 創建/更新 Supabase 用戶
      const { session, user } = await createOrUpdateSupabaseUser(
        userProfile,
        tokens.access_token,
        tokens.refresh_token
      );
      
      // 8. 導航到首頁
      navigate('/home');
    };
    
    handleLineCallback().catch(error => {
      console.error('LINE callback error:', error);
      toast.error('處理 LINE 登入回調時發生錯誤');
      navigate('/auth');
    });
  }, []);
  
  return <div>處理 LINE 登入中...</div>;
};
```

**工作量細分**：
- 實作回調處理邏輯：2 小時
- 整合到現有路由：1 小時
- 測試回調流程：1 小時

---

### 6. Deep Link 處理（2-3 小時）

#### 6.1 更新 app-lifecycle.ts

**檔案**：`src/lib/app-lifecycle.ts`

需要更新 `appUrlOpen` 處理邏輯，識別 LINE 回調：

```typescript
App.addListener('appUrlOpen', async (data) => {
  // 處理 LINE OAuth 回調
  if (data.url.includes('code=') && data.url.includes('state=')) {
    // 解析 URL 參數
    const url = new URL(data.url.replace('votechaos://', 'https://'));
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    // 觸發 LINE 回調處理事件
    window.dispatchEvent(new CustomEvent('line-oauth-callback', {
      detail: { code, state, url: data.url }
    }));
    return;
  }
  
  // ... 其他處理邏輯
});
```

**工作量細分**：
- 更新 Deep Link 處理：1 小時
- 測試 App 版回調：1-2 小時

---

### 7. 錯誤處理與重試（2-4 小時）

#### 7.1 實作錯誤處理

需要處理的錯誤情況：
- 用戶取消授權
- 網路錯誤
- Token 交換失敗
- 用戶資訊取得失敗
- Supabase 用戶創建失敗
- State 驗證失敗

```typescript
// 錯誤處理範例
try {
  // OAuth 流程
} catch (error) {
  if (error.message.includes('user_cancelled')) {
    toast.info('您已取消 LINE 登入');
  } else if (error.message.includes('network')) {
    toast.error('網路錯誤，請稍後再試');
    // 可以實作自動重試
  } else {
    toast.error('LINE 登入失敗：' + error.message);
  }
  navigate('/auth');
}
```

**工作量細分**：
- 實作錯誤處理邏輯：2 小時
- 實作重試機制：1-2 小時

---

### 8. 測試與除錯（4-6 小時）

#### 8.1 測試項目

- [ ] 台灣用戶 LINE 登入（Web 版）
- [ ] 日本用戶 LINE 登入（Web 版）
- [ ] 台灣用戶 LINE 登入（App 版）
- [ ] 日本用戶 LINE 登入（App 版）
- [ ] 錯誤情況測試（取消、網路錯誤等）
- [ ] State 驗證測試（CSRF 防護）
- [ ] Token 過期處理測試
- [ ] 用戶資訊同步測試

**工作量細分**：
- 單元測試：2 小時
- 整合測試：2 小時
- 除錯和修復：2 小時

---

### 9. 文件與維護（2-3 小時）

#### 9.1 需要更新的文件

- [ ] 更新 LINE 登入指南
- [ ] 添加技術文件（API 說明）
- [ ] 添加維護指南（如何更新 Channel ID/Secret）
- [ ] 添加故障排除指南

---

## 📝 實作步驟建議

### Phase 1：基礎架構（4-6 小時）
1. 設定環境變數
2. 建立配置檔案
3. 實作地區偵測邏輯

### Phase 2：OAuth 流程（8-12 小時）
1. 實作授權 URL 生成
2. 實作 Token 交換
3. 實作用戶資訊取得
4. 實作 Supabase 用戶創建/更新

### Phase 3：整合與測試（6-8 小時）
1. 整合到 AuthPage
2. 實作回調處理
3. 更新 Deep Link 處理
4. 測試所有流程

### Phase 4：優化與文件（4-6 小時）
1. 錯誤處理和重試
2. 性能優化
3. 文件更新

**總計**：22-32 小時（約 3-4 個工作天）

---

## ⚠️ 風險與挑戰

### 技術風險

1. **OAuth 流程複雜**
   - LINE OAuth 2.0 流程較複雜
   - 需要處理多個步驟和錯誤情況
   - **風險等級**：中

2. **安全性考量**
   - State 參數驗證（防止 CSRF）
   - Token 安全儲存
   - Channel Secret 不能暴露在前端
   - **風險等級**：高 ⚠️

3. **Token 管理**
   - Access Token 過期處理
   - Refresh Token 刷新機制
   - **風險等級**：中

### 維護成本

1. **兩個 Channel 管理**
   - 需要同時維護台灣和日本 Channel
   - 更新 Channel Secret 時需要更新兩個環境變數

2. **測試複雜度**
   - 需要測試兩個地區的流程
   - 需要測試 Web 版和 App 版

3. **錯誤排查**
   - 問題可能出現在多個環節
   - 需要檢查 LINE API、Supabase、前端程式碼

---

## 💡 替代方案

### 方案 A：使用 Supabase Edge Function（推薦）⭐

**優點**：
- ✅ Channel Secret 不會暴露在前端
- ✅ 邏輯集中在後端，易於維護
- ✅ 可以動態選擇 Channel

**實作方式**：
1. 建立 Supabase Edge Function：`line-oauth`
2. 前端調用 Edge Function，傳遞用戶地區
3. Edge Function 根據地區選擇 Channel，處理 OAuth 流程
4. 返回 Supabase session

**工作量**：約 16-24 小時（比直接實作少 30%）

### 方案 B：使用環境變數切換（簡單）

**實作方式**：
1. 開發環境使用台灣 Channel
2. 生產環境使用日本 Channel（或反之）
3. 通過環境變數切換

**工作量**：約 2-4 小時

**缺點**：
- ❌ 無法同時支援兩個地區
- ❌ 需要部署兩個環境

---

## 🎯 建議

### 對於您的專案

**建議方案**：**先使用簡單方案，後續再考慮進階方案**

1. **短期（立即）**：
   - 選擇主要地區（台灣或日本）
   - 建立單一 Channel
   - 使用 Supabase 的標準 LINE Provider
   - **工作量**：0 小時（已實作）

2. **中期（1-2 週後）**：
   - 如果確實需要支援兩個地區
   - 實作 Supabase Edge Function 方案
   - **工作量**：16-24 小時

3. **長期（未來）**：
   - 考慮使用 LINE 的國際版 Channel（如果可用）
   - 或等待 Supabase 支援多 Channel

---

## 📊 總結

| 項目 | 工作量 | 建議 |
|------|--------|------|
| **直接實作（前端）** | 21-34 小時 | ⚠️ 不推薦（安全性問題） |
| **Edge Function 方案** | 16-24 小時 | ✅ 推薦 |
| **環境變數切換** | 2-4 小時 | ✅ 簡單但有限制 |
| **使用單一 Channel** | 0 小時 | ✅ 最簡單（已實作） |

**最終建議**：
- 如果主要用戶在一個地區，使用單一 Channel（已實作）
- 如果確實需要兩個地區，實作 Edge Function 方案
- 不建議直接在前端實作（安全性風險）



