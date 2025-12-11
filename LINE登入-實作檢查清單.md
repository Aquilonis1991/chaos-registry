# LINE 登入實作檢查清單

> **方案**：使用 Supabase Edge Function 實作 LINE 登入  
> **更新日期**：2025-01-29

---

## ✅ 已完成的工作

### 程式碼檔案
- [x] 資料庫 Migration：`supabase/migrations/20250129000000_add_line_user_id_to_profiles.sql` ✅
- [x] Edge Function：`supabase/functions/line-auth/index.ts` ✅
- [x] 前端更新：`src/pages/AuthPage.tsx` ✅
  - [x] `handleLineLogin` 函數 ✅
  - [x] `handleSocialLogin` 更新（LINE 使用自訂處理）✅
  - [x] LINE 回調處理邏輯 ✅

### LINE Developers Console
- [x] Channel ID：`2008600116` ✅
- [x] Channel Secret：`079ebaa784b4c00184e68bafb1841d77` ✅
- [x] Callback URLs 已設定 ✅
- [x] Mobile App 設定已完成 ✅

---

## ⏳ 待執行的工作

### 步驟 1：執行資料庫 Migration

**方法 1：使用 Supabase CLI（推薦）**
```bash
cd votechaos-main
npx supabase login
npx supabase link --project-ref epyykzxxglkjombvozhr
npx supabase db push
```

**方法 2：在 Supabase Dashboard 中執行**
1. 登入 Supabase Dashboard
2. 進入 SQL Editor
3. 複製 `20250129000000_add_line_user_id_to_profiles.sql` 的內容
4. 貼上並執行

**驗證**：
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'line_user_id';
```

- [ ] Migration 已執行
- [ ] `line_user_id` 欄位已添加
- [ ] 索引已建立

---

### 步驟 2：設定環境變數

在 Supabase Dashboard → Project Settings → Edge Functions → Secrets 中添加：

| 變數名稱 | 值 | 狀態 |
|---------|-----|------|
| `LINE_CHANNEL_ID` | `2008600116` | ⏳ |
| `LINE_CHANNEL_SECRET` | `079ebaa784b4c00184e68bafb1841d77` | ⏳ |
| `LINE_REDIRECT_URI` | `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback` | ⏳ |
| `FRONTEND_URL` | `https://chaos-registry.vercel.app` | ⏳ |
| `FRONTEND_DEEP_LINK` | `votechaos://auth/callback` | ⏳ |
| `SERVICE_ROLE_KEY` | （從 Project Settings → API 取得）⚠️ 不能使用 `SUPABASE_SERVICE_ROLE_KEY` | ⏳ |

**如何取得 Service Role Key**：
1. Supabase Dashboard → Project Settings → API
2. 找到 **Service Role Key**
3. 複製並添加到 Edge Functions Secrets

- [ ] 所有環境變數已設定
- [ ] Service Role Key 已添加

---

### 步驟 3：部署 Edge Function

```bash
cd votechaos-main
npx supabase login
npx supabase link --project-ref epyykzxxglkjombvozhr
npx supabase functions deploy line-auth
```

**驗證部署**：
```bash
curl https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/auth
```

應該返回 JSON，包含 `authUrl` 和 `state`。

- [ ] Edge Function 已部署
- [ ] `/auth` 端點測試成功

---

### 步驟 4：更新 LINE Developers Console

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇 Provider：`ChaosRegistry`
3. 選擇 Channel：`2008600116`
4. 進入 **LINE Login** 設定
5. 在 **Callback URL** 中添加：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
   ```

- [ ] Callback URL 已添加

---

### 步驟 5：測試

**Web 版測試**：
1. 打開 `https://chaos-registry.vercel.app/auth`
2. 點擊「使用 LINE 登入」
3. 應該跳轉到 LINE 授權頁面
4. 授權後應該返回並完成登入

**App 版測試**：
1. 運行 App
2. 點擊「使用 LINE 登入」
3. 應該打開瀏覽器顯示 LINE 授權頁面
4. 授權後應該透過 Deep Link 返回 App 並完成登入

- [ ] Web 版測試成功
- [ ] App 版測試成功

---

## 📝 詳細步驟

如需詳細的步驟說明，請參考：
- [LINE 登入 - Edge Function 實作詳細步驟](./LINE登入-EdgeFunction實作步驟.md)

---

## 🔗 相關文件

- [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md)
- [LINE 第三方登入完整設定指南](./LINE第三方登入完整設定指南.md)
- [LINE 登入 - Edge Function 實作詳細步驟](./LINE登入-EdgeFunction實作步驟.md)

---

## ⚠️ 重要提醒

1. **環境變數**：確保所有環境變數已正確設定
2. **Service Role Key**：這是敏感資訊，請妥善保管
3. **Callback URL**：必須與 LINE Developers Console 中的設定一致
4. **測試**：在生產環境部署前，充分測試功能

---

**完成所有步驟後，LINE 登入功能就可以使用了！** 🎉

