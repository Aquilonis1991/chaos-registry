# Apple Server-to-Server Notification 完整設定指南

## 📋 目錄

1. [功能檢查報告](#功能檢查報告)
2. [相關功能清單](#相關功能清單)
3. [目前設定狀態](#目前設定狀態)
4. [完整設定步驟](#完整設定步驟)
5. [Edge Function 實作](#edge-function-實作)
6. [測試與驗證](#測試與驗證)

---

## 🔍 功能檢查報告

### 已確認的相關功能

#### 1. ✅ Apple 登入功能
- **位置**: `src/pages/AuthPage.tsx`
- **狀態**: 已實作
- **功能**: 支援 Apple Sign In 第三方登入
- **相關檔案**:
  - `src/pages/AuthPage.tsx` (line 259-427)
  - `src/contexts/AuthContext.tsx` (認證狀態管理)

#### 2. ✅ 帳號刪除功能
- **位置**: `src/components/DeleteAccountDialog.tsx`
- **狀態**: 已實作
- **功能**: 用戶可自行刪除帳號
- **RPC 函數**: `user_self_delete`
- **刪除類型**: 軟刪除（標記 `is_deleted = true`）
- **相關檔案**:
  - `src/components/DeleteAccountDialog.tsx`
  - `sql_patches/add_user_self_delete.sql`
  - `sql_patches/20251122_add_user_soft_delete.sql`

#### 3. ✅ 資料清理機制
- **位置**: 資料庫函數與 RPC
- **狀態**: 已實作
- **功能**: 
  - 軟刪除標記 (`is_deleted`, `deleted_at`, `deleted_by`)
  - 刪除日誌記錄 (`user_deletion_logs`)
  - Email 混淆處理
  - Audit Log 記錄
- **相關檔案**:
  - `sql_patches/add_user_self_delete.sql`
  - `sql_patches/20251122_add_user_soft_delete.sql`

#### 4. ✅ 用戶資料結構
- **位置**: `public.profiles` 表
- **狀態**: 已實作
- **欄位**:
  - `is_deleted` (BOOLEAN)
  - `deleted_at` (TIMESTAMPTZ)
  - `deleted_by` (UUID)
  - `deleted_reason` (TEXT)

#### 5. ⚠️ Apple Notification 處理端點
- **位置**: 尚未建立
- **狀態**: **缺失** - 需要建立
- **功能**: 接收並處理 Apple Server-to-Server Notification

---

## 📝 相關功能清單

### 資料庫相關

1. **`public.profiles` 表**
   - 軟刪除欄位：`is_deleted`, `deleted_at`, `deleted_by`, `deleted_reason`
   - 與 `auth.users` 關聯：`ON DELETE CASCADE`

2. **`public.user_deletion_logs` 表**
   - 記錄所有刪除操作
   - 包含用戶快照 (`profile_snapshot`)
   - 記錄刪除原因 (`deleted_reason`)

3. **`public.audit_logs` 表**
   - 記錄所有刪除操作的審計日誌

4. **RPC 函數**
   - `user_self_delete(p_reason TEXT)`: 用戶自行刪除帳號

### 前端相關

1. **刪除帳號 UI**
   - `src/components/DeleteAccountDialog.tsx`
   - 需要輸入 "DELETE" 確認
   - 調用 `user_self_delete` RPC

2. **Apple 登入 UI**
   - `src/pages/AuthPage.tsx`
   - 支援 Apple Sign In 按鈕

### 後端相關

1. **Supabase Auth**
   - Apple Provider 配置（需在 Dashboard 設定）
   - OAuth 回調處理

2. **Edge Functions**
   - ⚠️ **缺失**: Apple Notification 處理端點

---

## 📊 目前設定狀態

### Apple Developer Portal

#### ✅ 已完成項目
- [ ] App ID 建立（Bundle ID: `com.votechaos.app`）
- [ ] Services ID 建立（Identifier: `com.votechaos.app.services`）
- [ ] Key 建立與下載（.p8 檔案）
- [ ] Sign In with Apple 啟用

#### ⚠️ 待完成項目
- [ ] **Server-to-Server Notification Endpoint** 設定

### Supabase Dashboard

#### ✅ 已完成項目
- [ ] Apple Provider 啟用
- [ ] Services ID 設定
- [ ] Secret Key 設定
- [ ] Key ID 設定
- [ ] Team ID 設定

#### ⚠️ 待完成項目
- [ ] Apple Notification Edge Function 建立
- [ ] Edge Function 部署

---

## 🛠️ 完整設定步驟

### 步驟 1: 建立 Apple Notification Edge Function

#### 1.1 建立函數目錄

```bash
cd votechaos-main/supabase/functions
mkdir apple-notification
cd apple-notification
```

#### 1.2 建立 `index.ts`

建立檔案：`supabase/functions/apple-notification/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { corsHeaders } from "../_shared/cors.ts";

// Apple Notification 類型
type AppleNotificationType = 
  | "EMAIL_DISABLED"      // 用戶禁用郵件轉發
  | "EMAIL_ENABLED"       // 用戶啟用郵件轉發
  | "CONSENT_REVOKED"     // 用戶撤銷同意
  | "ACCOUNT_DELETE";     // 用戶永久刪除 Apple 帳號

interface AppleNotificationPayload {
  type: AppleNotificationType;
  sub: string;  // Apple 用戶識別符（Apple Subject）
  email?: string;
  email_verified?: boolean;
  is_private_email?: boolean;
  event_id: string;  // 事件 ID（用於去重）
  events_enabled?: boolean;
}

serve(async (req) => {
  // 處理 CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 驗證請求方法
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { 
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 解析請求內容
    const payload: AppleNotificationPayload = await req.json();
    
    console.log("[Apple Notification] Received:", {
      type: payload.type,
      sub: payload.sub,
      event_id: payload.event_id
    });

    // 建立 Supabase 客戶端（使用 service role）
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 處理不同類型的通知
    switch (payload.type) {
      case "ACCOUNT_DELETE":
        await handleAccountDelete(supabase, payload);
        break;
        
      case "EMAIL_DISABLED":
        await handleEmailDisabled(supabase, payload);
        break;
        
      case "EMAIL_ENABLED":
        await handleEmailEnabled(supabase, payload);
        break;
        
      case "CONSENT_REVOKED":
        await handleConsentRevoked(supabase, payload);
        break;
        
      default:
        console.warn("[Apple Notification] Unknown type:", payload.type);
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Apple Notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

/**
 * 處理 Apple 帳號刪除
 */
async function handleAccountDelete(
  supabase: any,
  payload: AppleNotificationPayload
) {
  console.log("[Apple Notification] Processing ACCOUNT_DELETE for:", payload.sub);

  try {
    // 1. 找到對應的 Supabase 用戶
    // Apple 用戶識別符通常存在於 user_metadata 或 app_metadata 中
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("[Apple Notification] Error listing users:", listError);
      throw listError;
    }

    // 尋找使用 Apple 登入且 sub 匹配的用戶
    const appleUser = users.users.find((u: any) => {
      // 檢查 provider
      const provider = u.app_metadata?.provider || u.user_metadata?.provider;
      if (provider !== "apple") return false;

      // 檢查 Apple Subject (sub)
      const appleSub = 
        u.app_metadata?.apple_sub || 
        u.user_metadata?.apple_sub ||
        u.identities?.find((id: any) => id.provider === "apple")?.id;
      
      return appleSub === payload.sub;
    });

    if (!appleUser) {
      console.warn("[Apple Notification] No matching user found for sub:", payload.sub);
      return;
    }

    console.log("[Apple Notification] Found user:", appleUser.id);

    // 2. 檢查用戶是否已經被刪除
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_deleted")
      .eq("id", appleUser.id)
      .single();

    if (profile?.is_deleted) {
      console.log("[Apple Notification] User already deleted:", appleUser.id);
      return;
    }

    // 3. 調用 user_self_delete RPC 函數
    const { data: deleteResult, error: deleteError } = await supabase.rpc(
      "user_self_delete",
      {
        p_reason: "apple_account_deleted"
      }
    );

    if (deleteError) {
      console.error("[Apple Notification] Error deleting user:", deleteError);
      throw deleteError;
    }

    console.log("[Apple Notification] User deleted successfully:", appleUser.id);

    // 4. 記錄到 audit log
    await supabase.from("audit_logs").insert({
      user_id: appleUser.id,
      action: "apple_account_deleted",
      resource_type: "user",
      resource_id: appleUser.id,
      metadata: {
        apple_sub: payload.sub,
        event_id: payload.event_id,
        notification_type: "ACCOUNT_DELETE"
      }
    });

  } catch (error) {
    console.error("[Apple Notification] handleAccountDelete error:", error);
    throw error;
  }
}

/**
 * 處理郵件轉發禁用
 */
async function handleEmailDisabled(
  supabase: any,
  payload: AppleNotificationPayload
) {
  console.log("[Apple Notification] Processing EMAIL_DISABLED for:", payload.sub);
  
  // 可以更新用戶設定，標記郵件轉發已禁用
  // 目前專案可能不需要特別處理，但可以記錄到 audit log
  
  const { data: users } = await supabase.auth.admin.listUsers();
  const appleUser = users.users.find((u: any) => {
    const provider = u.app_metadata?.provider || u.user_metadata?.provider;
    if (provider !== "apple") return false;
    const appleSub = 
      u.app_metadata?.apple_sub || 
      u.user_metadata?.apple_sub ||
      u.identities?.find((id: any) => id.provider === "apple")?.id;
    return appleSub === payload.sub;
  });

  if (appleUser) {
    await supabase.from("audit_logs").insert({
      user_id: appleUser.id,
      action: "apple_email_disabled",
      resource_type: "user",
      resource_id: appleUser.id,
      metadata: {
        apple_sub: payload.sub,
        event_id: payload.event_id
      }
    });
  }
}

/**
 * 處理郵件轉發啟用
 */
async function handleEmailEnabled(
  supabase: any,
  payload: AppleNotificationPayload
) {
  console.log("[Apple Notification] Processing EMAIL_ENABLED for:", payload.sub);
  
  // 類似 EMAIL_DISABLED，記錄到 audit log
  const { data: users } = await supabase.auth.admin.listUsers();
  const appleUser = users.users.find((u: any) => {
    const provider = u.app_metadata?.provider || u.user_metadata?.provider;
    if (provider !== "apple") return false;
    const appleSub = 
      u.app_metadata?.apple_sub || 
      u.user_metadata?.apple_sub ||
      u.identities?.find((id: any) => id.provider === "apple")?.id;
    return appleSub === payload.sub;
  });

  if (appleUser) {
    await supabase.from("audit_logs").insert({
      user_id: appleUser.id,
      action: "apple_email_enabled",
      resource_type: "user",
      resource_id: appleUser.id,
      metadata: {
        apple_sub: payload.sub,
        event_id: payload.event_id
      }
    });
  }
}

/**
 * 處理同意撤銷
 */
async function handleConsentRevoked(
  supabase: any,
  payload: AppleNotificationPayload
) {
  console.log("[Apple Notification] Processing CONSENT_REVOKED for:", payload.sub);
  
  // 用戶撤銷同意，可能需要標記用戶或限制功能
  // 目前可以記錄到 audit log，未來可以實作更詳細的處理
  
  const { data: users } = await supabase.auth.admin.listUsers();
  const appleUser = users.users.find((u: any) => {
    const provider = u.app_metadata?.provider || u.user_metadata?.provider;
    if (provider !== "apple") return false;
    const appleSub = 
      u.app_metadata?.apple_sub || 
      u.user_metadata?.apple_sub ||
      u.identities?.find((id: any) => id.provider === "apple")?.id;
    return appleSub === payload.sub;
  });

  if (appleUser) {
    await supabase.from("audit_logs").insert({
      user_id: appleUser.id,
      action: "apple_consent_revoked",
      resource_type: "user",
      resource_id: appleUser.id,
      metadata: {
        apple_sub: payload.sub,
        event_id: payload.event_id
      }
    });
  }
}
```

#### 1.3 部署 Edge Function

```bash
# 在專案根目錄執行
cd votechaos-main
npx supabase functions deploy apple-notification
```

### 步驟 2: 在 Apple Developer Portal 設定

#### 2.1 導航到 Services ID 設定

1. 前往 [Apple Developer Portal](https://developer.apple.com/)
2. 登入您的 Apple Developer 帳號
3. 導航到 **Certificates, Identifiers & Profiles**
4. 選擇 **Identifiers** > **Services IDs**
5. 找到您的 Services ID：`com.votechaos.app.services`
6. 點擊進入詳細設定

#### 2.2 設定 Sign In with Apple

1. 在 Services ID 詳細頁面，找到 **Sign In with Apple** 區塊
2. 點擊 **Configure** 按鈕
3. 在設定頁面中，找到 **Server-to-Server Notification Endpoint** 欄位

#### 2.3 填入 Notification Endpoint URL

在 **Server-to-Server Notification Endpoint** 欄位中填入：

```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/apple-notification
```

**重要提醒**：
- ✅ 必須使用 HTTPS（TLS 1.2 或更高）
- ✅ 必須是完整的絕對 URL（包含 scheme、host、path）
- ✅ URL 格式必須正確，不能有尾隨斜線

#### 2.4 儲存設定

1. 點擊 **Save** 按鈕
2. 點擊 **Continue** 確認
3. 完成設定

---

## 📋 目前應該填寫的內容

### Apple Developer Portal

#### Services ID 設定頁面

**Server-to-Server Notification Endpoint** 欄位：

```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/apple-notification
```

**說明**：
- 這是 Supabase Edge Function 的完整 URL
- 用於接收 Apple 發送的伺服器到伺服器通知
- 必須在部署 Edge Function 後才能填入

---

## ✅ 檢查清單

### 前置準備

- [ ] Supabase 專案已建立
- [ ] Apple Developer Program 會員資格已取得（$99 USD/年）
- [ ] App ID 已建立（Bundle ID: `com.votechaos.app`）
- [ ] Services ID 已建立（Identifier: `com.votechaos.app.services`）
- [ ] Key 已建立並下載（.p8 檔案）
- [ ] Supabase Dashboard 中 Apple Provider 已啟用

### Edge Function 建立

- [ ] 建立 `supabase/functions/apple-notification` 目錄
- [ ] 建立 `index.ts` 檔案
- [ ] 實作 `handleAccountDelete` 函數
- [ ] 實作 `handleEmailDisabled` 函數
- [ ] 實作 `handleEmailEnabled` 函數
- [ ] 實作 `handleConsentRevoked` 函數
- [ ] 部署 Edge Function

### Apple Developer Portal 設定

- [ ] 導航到 Services ID 設定頁面
- [ ] 找到 **Server-to-Server Notification Endpoint** 欄位
- [ ] 填入：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/apple-notification`
- [ ] 點擊 **Save** 儲存
- [ ] 確認設定已儲存

### 測試與驗證

- [ ] 測試 Edge Function 是否可訪問
- [ ] 檢查 Edge Function 日誌
- [ ] 驗證通知處理邏輯
- [ ] 測試帳號刪除流程

---

## 🔍 測試與驗證

### 測試 Edge Function

#### 方法 1: 使用 curl

```bash
curl -X POST https://epyykzxxglkjombvozhr.supabase.co/functions/v1/apple-notification \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ACCOUNT_DELETE",
    "sub": "test_apple_sub",
    "event_id": "test_event_123"
  }'
```

#### 方法 2: 檢查 Supabase Dashboard

1. 前往 Supabase Dashboard
2. 導航到 **Edge Functions** > **apple-notification**
3. 查看 **Logs** 標籤
4. 檢查是否有錯誤或警告

### 驗證通知處理

1. **檢查 Audit Logs**
   ```sql
   SELECT * FROM public.audit_logs 
   WHERE action LIKE 'apple_%' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

2. **檢查 User Deletion Logs**
   ```sql
   SELECT * FROM public.user_deletion_logs 
   WHERE deleted_reason = 'apple_account_deleted'
   ORDER BY deleted_at DESC 
   LIMIT 10;
   ```

3. **檢查軟刪除的用戶**
   ```sql
   SELECT id, nickname, deleted_at, deleted_reason 
   FROM public.profiles 
   WHERE is_deleted = true 
   AND deleted_reason = 'apple_account_deleted'
   ORDER BY deleted_at DESC;
   ```

---

## ⚠️ 重要注意事項

### 安全性

1. **JWT 驗證**（未來增強）
   - 目前實作未包含 Apple JWT 驗證
   - 建議未來實作 JWT 驗證以確保通知來自 Apple
   - 參考：[Apple Server-to-Server Notification 文件](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user)

2. **去重處理**
   - 使用 `event_id` 避免重複處理相同通知
   - 建議實作事件 ID 記錄表

3. **錯誤處理**
   - 所有錯誤都應記錄到 audit log
   - 失敗的通知應有重試機制

### 資料一致性

1. **用戶識別**
   - Apple Subject (`sub`) 可能存儲在不同位置
   - 需要檢查 `app_metadata`、`user_metadata` 和 `identities`

2. **軟刪除 vs 硬刪除**
   - 目前使用軟刪除（標記 `is_deleted = true`）
   - 符合 GDPR 要求，保留審計記錄

3. **關聯資料處理**
   - 刪除用戶時，相關資料會透過 `ON DELETE CASCADE` 自動處理
   - 但某些資料可能需要特殊處理（如主題、投票等）

---

## 📚 相關文件

- [Apple Sign In with Apple 文件](https://developer.apple.com/sign-in-with-apple/)
- [Apple Server-to-Server Notification 文件](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api)
- [Supabase Edge Functions 文件](https://supabase.com/docs/guides/functions)
- [專案 Apple 登入設定指南](./Google_Apple_第三方登入申請流程完整指南.md)

---

## 🎯 總結

### 目前狀態

- ✅ **Apple 登入功能**: 已實作
- ✅ **帳號刪除功能**: 已實作
- ✅ **資料清理機制**: 已實作
- ⚠️ **Apple Notification 處理**: **需要建立**

### 下一步行動

1. **立即執行**：
   - 建立 `apple-notification` Edge Function
   - 部署 Edge Function
   - 在 Apple Developer Portal 填入 Notification Endpoint URL

2. **未來增強**：
   - 實作 Apple JWT 驗證
   - 實作事件 ID 去重機制
   - 增強錯誤處理和重試機制

---

**最後更新**: 2025-01-08  
**適用版本**: Supabase 最新版、Apple Developer Portal 最新版
