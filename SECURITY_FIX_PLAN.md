# 🔒 安全問題修復執行計劃

> **目標**: 將安全評分從 72 提升到 85+  
> **時間**: 1-2 週  
> **優先級**: 修復所有 P0 和 P1 問題

---

## ⚡ 快速修復清單（可立即執行）

### ✅ Fix 1: 環境變數保護（5分鐘）

**問題**: .env.local 可能被提交到 Git  
**風險**: 🔴 嚴重

**立即執行**:
```powershell
# 1. 檢查 .gitignore
Get-Content .gitignore | Select-String ".env"

# 2. 如果沒有，添加保護
@"
# 環境變數
.env
.env.local
.env.*.local
.env.production
.env.development
"@ | Add-Content .gitignore

# 3. 創建範本檔案
@"
# Supabase 連接資訊
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
"@ | Out-File -FilePath .env.example -Encoding utf8
```

**驗證**: `Get-Content .gitignore` 應該包含 `.env.local`

---

### ✅ Fix 2: 安裝防抖庫（2分鐘）

**問題**: 搜尋可能過度查詢  
**風險**: 🔴 高

**執行**:
```powershell
npm install use-debounce
```

**使用**:
```typescript
// src/hooks/useSearch.tsx
import { useDebouncedCallback } from 'use-debounce';

const debouncedSearch = useDebouncedCallback(
  (query: string) => {
    performActualSearch(query);
  },
  500 // 500ms 延遲
);
```

---

### ✅ Fix 3: 安裝 XSS 防護（2分鐘）

**問題**: 用戶輸入可能包含惡意腳本  
**風險**: 🟡 中高

**執行**:
```powershell
npm install dompurify
npm install --save-dev @types/dompurify
```

**使用**:
```typescript
// src/lib/sanitize.ts
import DOMPurify from 'dompurify';

export const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};

export const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html);
};
```

---

## 🔧 代碼修復（需要修改檔案）

### Fix 4: 統一密碼驗證（15分鐘）

**檔案**: `src/pages/AuthPage.tsx`

**添加密碼驗證**:
```typescript
// 在 handleSignup 函數中添加
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
if (!passwordRegex.test(password)) {
  toast.error('密碼必須包含大小寫字母和數字，至少8個字元');
  return;
}
```

---

### Fix 5: 搜尋防抖實現（10分鐘）

**檔案**: `src/components/SearchBar.tsx`

**修改**:
```typescript
import { useDebouncedCallback } from 'use-debounce';

// 在組件中
const debouncedSearch = useDebouncedCallback(
  (query: string) => {
    search(query);
  },
  500
);

// onChange 時調用
onChange={(e) => {
  setQuery(e.target.value);
  debouncedSearch(e.target.value);
}}
```

---

### Fix 6: 按鈕防重複點擊（20分鐘）

**創建全局 Hook**: `src/hooks/useAsyncAction.tsx`

```typescript
import { useState } from 'react';

export const useAsyncAction = () => {
  const [loading, setLoading] = useState(false);

  const execute = async <T,>(
    action: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: any) => void
  ) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const result = await action();
      onSuccess?.(result);
      return result;
    } catch (error) {
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading };
};
```

**使用範例**:
```typescript
const { execute, loading } = useAsyncAction();

<Button 
  onClick={() => execute(
    () => castVote(topicId, option, amount),
    () => toast.success('投票成功'),
    () => toast.error('投票失敗')
  )}
  disabled={loading}
>
  {loading ? '處理中...' : '投票'}
</Button>
```

---

### Fix 7: 限制 CORS（30分鐘）

**修改所有 Edge Functions**:

檔案清單：
- `supabase/functions/cast-vote/index.ts`
- `supabase/functions/cast-free-vote/index.ts`
- `supabase/functions/create-topic/index.ts`
- `supabase/functions/watch-ad/index.ts`
- `supabase/functions/complete-mission/index.ts`

**修改**:
```typescript
const ALLOWED_ORIGINS = [
  'https://epyykzxxglkjombvozhr.supabase.co', // Supabase hosted
  'https://yourdomain.com', // 生產環境
  'capacitor://localhost', // Capacitor APP
  'http://localhost:5173', // 開發環境
  'http://localhost:8080'
];

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  
  // CORS 檢查
  if (req.method !== 'OPTIONS' && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response('Forbidden', { 
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ... 其餘邏輯
});
```

---

### Fix 8: IP 記錄（20分鐘）

**修改所有 Edge Functions** 添加：

```typescript
// 獲取 IP
const getClientIP = (req: Request): string => {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') || // Cloudflare
         'unknown';
};

const ipAddress = getClientIP(req);
const userAgent = req.headers.get('user-agent') || 'unknown';

// 記錄到 audit_logs
await supabaseClient
  .from('audit_logs')
  .insert({
    user_id: user?.id || null,
    action: 'cast_vote',
    resource_type: 'topic',
    resource_id: topic_id,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: { amount, option }
  });
```

---

## 📊 修復進度追蹤

### 🔴 Critical（必須）- 5個

- [ ] ✅ Fix 1: 環境變數保護（5分鐘）
- [ ] ✅ Fix 2: 安裝防抖庫（2分鐘）
- [ ] ✅ Fix 3: 安裝 XSS 防護（2分鐘）
- [ ] 🔧 Fix 4: 統一密碼驗證（15分鐘）
- [ ] 🔧 Fix 5: 搜尋防抖實現（10分鐘）

**總時間**: ~34 分鐘

---

### 🟡 High（應該）- 4個

- [ ] 🔧 Fix 6: 按鈕防重複（20分鐘）
- [ ] 🔧 Fix 7: CORS 限制（30分鐘）
- [ ] 🔧 Fix 8: IP 記錄（20分鐘）
- [ ] ⚙️ Fix 9: Email 驗證（10分鐘配置）

**總時間**: ~80 分鐘

---

### 🟢 Medium（建議）- 3個

- [ ] 📊 Fix 10: 審計日誌 UI（2-3小時）
- [ ] 🚫 Fix 11: 內容過濾（2-3小時）
- [ ] 🛡️ Fix 12: 風控基礎（4-5小時）

**總時間**: ~8-11 小時

---

## 🎯 完整修復時間表

### Day 1（今天）- 環境和基礎（2小時）
- ✅ Fix 1-3: 環境保護 + 安裝依賴
- 🔧 Fix 4-5: 密碼驗證 + 搜尋防抖

### Day 2-3 - 核心安全（4小時）
- 🔧 Fix 6: 按鈕防重複
- 🔧 Fix 7-8: CORS + IP 記錄
- ⚙️ Fix 9: Email 驗證

### Week 2 - 進階功能（1-2天）
- 📊 Fix 10: 審計日誌 UI
- 🚫 Fix 11: 內容過濾
- 🛡️ Fix 12: 風控基礎

**總計**: 約 **2 週**完成所有安全改進

---

## ✅ 修復後的安全評分預測

| 類別 | 當前 | 修復後 | 提升 |
|------|------|--------|------|
| 認證安全 | 80 | **90** | +10 |
| 資料保護 | 85 | **95** | +10 |
| 輸入驗證 | 75 | **90** | +15 |
| API 安全 | 65 | **85** | +20 |
| 隱私保護 | 70 | **85** | +15 |
| 風控系統 | 40 | **70** | +30 |
| 審計追蹤 | 60 | **80** | +20 |
| Session 管理 | 75 | **85** | +10 |
| **總分** | **72** | **85** | **+13** |

---

## 💡 建議執行順序

### 🎯 **最小化風險策略**（推薦）

1. **今天**: 修復環境變數問題（最嚴重）
2. **明天**: 添加防抖和防重複（影響體驗）
3. **本週**: CORS 和密碼驗證（安全基礎）
4. **下週**: IP 記錄和 Email 驗證（完善保護）
5. **下下週**: 審計 UI 和風控（高級功能）

---

## 🎊 修復完成後

您將獲得：

- ✅ **A 級安全評分**（85/100）
- ✅ 符合上架安全標準
- ✅ 防護常見攻擊
- ✅ 完善的審計追蹤
- ✅ 用戶信任度提升

**可以安心上架！** 🚀

---

**您希望我立即開始修復這些安全問題嗎？**

建議從 Fix 1-5（Critical）開始，這些可以在 1-2 小時內完成。


