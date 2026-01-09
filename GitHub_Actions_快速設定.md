# GitHub Actions Apple JWT 快速設定

## 🚀 3 步驟完成設定

### 步驟 1：設定 GitHub Secrets（5 分鐘）

前往：`https://github.com/[您的帳號]/[Repository名稱]/settings/secrets/actions`

新增 3 個 Secrets：

| Secret 名稱 | 值 | 範例 |
|------------|-----|------|
| `APPLE_TEAM_ID` | Team ID | `ABC123DEF4` |
| `APPLE_KEY_ID` | Key ID | `XYZ789GHI0` |
| `APPLE_KEY_FILE` | .p8 檔案完整內容 | `-----BEGIN PRIVATE KEY-----...` |

### 步驟 2：測試執行（2 分鐘）

1. 前往：`https://github.com/[您的帳號]/[Repository名稱]/actions`
2. 找到 **Update Apple JWT Token** 工作流程
3. 點擊 **Run workflow** > **Run workflow**
4. 等待執行完成（約 1-2 分鐘）

### 步驟 3：更新 Supabase（3 分鐘）

1. 檢查自動建立的 GitHub Issue
2. 複製 JWT Token
3. 前往 Supabase Dashboard > Authentication > Providers > Apple
4. 貼上 JWT Token 到 **Secret Key** 欄位
5. 點擊 **Save**

---

## ✅ 完成！

之後 GitHub Actions 會：
- 每 150 天自動執行
- 自動建立 Issue 提醒您
- 完全自動化

---

## 📋 需要準備的資訊

- ✅ Team ID：`ABC123DEF4`
- ✅ Key ID：`XYZ789GHI0`
- ✅ .p8 檔案內容（完整）

---

## 🔍 詳細說明

完整設定指南：`GitHub_Actions_Apple_JWT_設定指南.md`
