# LINE 登入 - 環境變數設定提醒

> **更新日期**：2025-01-29

---

## ⚠️ 重要提醒

**Supabase 不允許環境變數名稱以 `SUPABASE_` 開頭！**

---

## ✅ 正確的環境變數名稱

在 Supabase Dashboard → Edge Functions → Secrets 中設定時，請使用以下名稱：

| 變數名稱 | 說明 | 是否自動設定 |
|---------|------|------------|
| `SUPABASE_URL` | Supabase 專案 URL | ✅ 自動（Supabase 保留） |
| `SUPABASE_ANON_KEY` | Supabase Anon Key | ✅ 自動（Supabase 保留） |
| `SERVICE_ROLE_KEY` | Service Role Key | ❌ 需手動添加 |
| `LINE_CHANNEL_ID` | LINE Channel ID | ❌ 需手動添加 |
| `LINE_CHANNEL_SECRET` | LINE Channel Secret | ❌ 需手動添加 |
| `LINE_REDIRECT_URI` | LINE 回調 URL（可選） | ❌ 可選 |
| `FRONTEND_URL` | 前端網站 URL（可選） | ❌ 可選 |
| `FRONTEND_DEEP_LINK` | App Deep Link（可選） | ❌ 可選 |

---

## ❌ 錯誤的環境變數名稱

**不要使用**：
- ❌ `SUPABASE_SERVICE_ROLE_KEY`（會顯示錯誤：`Name must not start with the SUPABASE_ prefix`）

**正確使用**：
- ✅ `SERVICE_ROLE_KEY`

---

## 📝 設定步驟

1. 前往 Supabase Dashboard → **Edge Functions** → **Secrets**
2. 點擊 **「Add new secret」**
3. 輸入變數名稱：`SERVICE_ROLE_KEY`
4. 輸入值：從 **Project Settings** → **API** → **Service Role Key** 複製
5. 點擊 **「Save」**

---

## 🔗 相關文件

- [LINE 登入 - Edge Function 實作詳細步驟](./LINE登入-EdgeFunction實作步驟.md)
- [LINE 登入 - 實作檢查清單](./LINE登入-實作檢查清單.md)


