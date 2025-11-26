# 🚀 Vercel 快速部署指南

## ✅ 已完成
- [x] 代碼已推送到 GitHub：https://github.com/Aquilonis1991/chaos-registry

---

## 🎯 現在開始部署到 Vercel

### 步驟 1：訪問 Vercel

1. **打開瀏覽器**，訪問：https://vercel.com
2. **點擊右上角 "Sign Up"** 或 "Log In"

### 步驟 2：使用 GitHub 登入

1. **選擇 "Continue with GitHub"**
2. **授權 Vercel** 訪問你的 GitHub 帳號
3. 完成登入

### 步驟 3：導入專案

1. **在 Vercel Dashboard** 點擊 **"Add New..."** → **"Project"**
   - 或直接訪問：https://vercel.com/new

2. **選擇 GitHub 倉庫**
   - 在 "Import Git Repository" 中找到 `Aquilonis1991/chaos-registry`
   - 如果沒看到，點擊 **"Adjust GitHub App Permissions"** 授權

3. **點擊 "Import"**

### 步驟 4：配置專案

Vercel 應該會自動偵測到 Vite 專案，但請確認以下設定：

- **Framework Preset**: `Vite` ✅（應該自動偵測）
- **Root Directory**: `./`（留空或填 `./`）
- **Build Command**: `npm run build` ✅（應該自動填入）
- **Output Directory**: `dist` ✅（應該自動填入）
- **Install Command**: `npm install` ✅（應該自動填入）

### 步驟 5：設定環境變數 ⚠️ 重要！

**點擊 "Environment Variables"** 添加以下兩個變數：

#### 變數 1：
- **Name**: `VITE_SUPABASE_URL`
- **Value**: `https://epyykzxxglkjombvozhr.supabase.co`
- **Environment**: 選擇所有（Production, Preview, Development）

#### 變數 2：
- **Name**: `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweXlrenh4Z2xram9tYnZvemhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDg1MTEsImV4cCI6MjA3NTk4NDUxMX0.A2QBfDwW1TlG5GiKaHN3_JzT3Tk3U0hJfTZm0hRq1tg`
- **Environment**: 選擇所有（Production, Preview, Development）

**⚠️ 注意**：
- 變數名稱必須**完全一致**（包括 `VITE_` 前綴）
- 值**不要加引號**
- 兩個變數都要添加

### 步驟 6：部署

1. **點擊 "Deploy"** 按鈕
2. **等待建置完成**（通常 1-2 分鐘）
3. 建置過程中可以查看日誌

### 步驟 7：驗證部署

1. **建置成功後**，會顯示 "Ready" 和網址
2. **點擊 "Visit"** 或訪問顯示的網址
3. **測試功能**：
   - 訪問首頁
   - 測試登入
   - 訪問後台：`https://your-project.vercel.app/admin`

---

## 📋 部署後檢查清單

- [ ] 建置成功（沒有錯誤）
- [ ] 網站可以正常訪問
- [ ] 登入功能正常
- [ ] 後台可以訪問（`/admin`）
- [ ] 所有功能測試通過

---

## 🔧 如果遇到問題

### 問題 1：建置失敗

**檢查**：
- 環境變數是否正確設定
- 建置日誌中的錯誤訊息
- `package.json` 中是否有 `build` 腳本

### 問題 2：網站顯示空白

**檢查**：
- 環境變數是否正確（特別是 `VITE_` 前綴）
- 瀏覽器 Console 是否有錯誤（F12）
- Supabase 連接是否正常

### 問題 3：後台無法訪問

**檢查**：
- 是否已設定管理員權限（執行 `sql_patches/20251123_setup_admin.sql`）
- 是否使用正確的帳號登入
- 瀏覽器 Console 是否有錯誤

---

## 🎉 部署完成後

### 你的網站將：
- ✅ 24小時可用（無需本機開機）
- ✅ 自動 HTTPS
- ✅ 全球 CDN 加速
- ✅ 自動部署（每次 `git push` 自動更新）

### 後台網址：
```
https://your-project.vercel.app/admin
```

### 更新網站：
```bash
# 本地開發
npm run dev

# 提交更改
git add .
git commit -m "更新功能"
git push

# Vercel 自動部署（無需額外操作）
```

---

## 📞 需要幫助？

如果遇到問題：
1. 查看 Vercel 建置日誌
2. 檢查瀏覽器 Console（F12）
3. 確認 Supabase 連接狀態

---

**現在開始部署吧！** 🚀

訪問：https://vercel.com/new

