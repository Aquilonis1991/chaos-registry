# 🚀 Vercel 部署步驟指南

## 📋 部署前準備

### ✅ 已完成
- [x] 代碼已提交到本地 Git 倉庫
- [x] 環境變數已配置（`.env.local`）

### ⏳ 待完成
- [ ] 推送到 GitHub（如果還沒有遠端倉庫）
- [ ] 在 Vercel 註冊並連接 GitHub
- [ ] 設定環境變數
- [ ] 部署

---

## 🎯 步驟 1：準備 GitHub 倉庫

### 選項 A：如果已有 GitHub 倉庫

```bash
# 檢查遠端倉庫
git remote -v

# 如果有，直接推送
git push origin master
```

### 選項 B：如果沒有 GitHub 倉庫

1. **在 GitHub 創建新倉庫**
   - 訪問：https://github.com/new
   - 倉庫名稱：`chaos-registry`（或你喜歡的名稱）
   - 選擇：**Private**（建議）或 **Public**
   - **不要**勾選 "Initialize with README"
   - 點擊 "Create repository"

2. **連接本地倉庫到 GitHub**
   ```bash
   # 替換 YOUR_USERNAME 和 REPO_NAME
   git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

---

## 🎯 步驟 2：註冊 Vercel

1. **訪問 Vercel**
   - 網址：https://vercel.com
   - 點擊右上角 "Sign Up"

2. **使用 GitHub 登入**
   - 選擇 "Continue with GitHub"
   - 授權 Vercel 訪問你的 GitHub 帳號

---

## 🎯 步驟 3：部署專案

1. **創建新專案**
   - 在 Vercel Dashboard 點擊 "Add New..." → "Project"
   - 或直接訪問：https://vercel.com/new

2. **導入 GitHub 倉庫**
   - 在 "Import Git Repository" 中選擇你的倉庫
   - 如果沒看到，點擊 "Adjust GitHub App Permissions" 授權

3. **配置專案設定**
   - **Framework Preset**: `Vite`（應該自動偵測）
   - **Root Directory**: `./`（留空或填 `./`）
   - **Build Command**: `npm run build`（應該自動填入）
   - **Output Directory**: `dist`（應該自動填入）
   - **Install Command**: `npm install`（應該自動填入）

4. **設定環境變數**
   點擊 "Environment Variables" 添加：
   
   ```
   VITE_SUPABASE_URL = https://epyykzxxglkjombvozhr.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweXlrenh4Z2xram9tYnZvemhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDg1MTEsImV4cCI6MjA3NTk4NDUxMX0.A2QBfDwW1TlG5GiKaHN3_JzT3Tk3U0hJfTZm0hRq1tg
   ```
   
   **注意**：
   - 變數名稱必須完全一致（包括 `VITE_` 前綴）
   - 值不要加引號
   - 可以為不同環境（Production/Preview/Development）設定不同值

5. **部署**
   - 點擊 "Deploy" 按鈕
   - 等待 1-2 分鐘建置完成

---

## 🎯 步驟 4：驗證部署

1. **查看部署狀態**
   - 在 Vercel Dashboard 查看建置日誌
   - 如果成功，會顯示 "Ready" 和網址

2. **訪問網站**
   - 點擊 "Visit" 按鈕
   - 或直接訪問：`https://your-project.vercel.app`

3. **測試功能**
   - 測試登入功能
   - 測試後台：`https://your-project.vercel.app/admin`
   - 確認所有功能正常

---

## 🎯 步驟 5：設定自訂網域（可選）

1. **在 Vercel Dashboard**
   - 進入專案設定
   - 點擊 "Domains"
   - 輸入你的網域（例如：`chaosregistry.com`）

2. **設定 DNS**
   - 按照 Vercel 的指示設定 DNS 記錄
   - 通常需要添加 CNAME 記錄

---

## 🔧 常見問題

### Q1: 建置失敗？

**檢查**：
- 環境變數是否正確設定
- `package.json` 中是否有 `build` 腳本
- 建置日誌中的錯誤訊息

### Q2: 網站顯示空白？

**檢查**：
- 環境變數是否正確
- 瀏覽器 Console 是否有錯誤
- Supabase 連接是否正常

### Q3: 後台無法訪問？

**檢查**：
- 是否已設定管理員權限（執行 `sql_patches/20251123_setup_admin.sql`）
- 是否使用正確的帳號登入
- 瀏覽器 Console 是否有錯誤

---

## 📝 後續維護

### 更新網站

```bash
# 1. 本地開發
npm run dev

# 2. 提交更改
git add .
git commit -m "更新功能"
git push

# 3. Vercel 自動部署（無需額外操作）
```

### 查看部署歷史

- 在 Vercel Dashboard 可以查看所有部署
- 可以回滾到之前的版本
- 每個 PR 都有獨立的預覽環境

---

## ✅ 部署完成檢查清單

- [ ] GitHub 倉庫已創建並推送
- [ ] Vercel 帳號已註冊
- [ ] 專案已導入到 Vercel
- [ ] 環境變數已設定
- [ ] 部署成功
- [ ] 網站可以正常訪問
- [ ] 登入功能正常
- [ ] 後台可以訪問
- [ ] 所有功能測試通過

---

## 🎉 完成！

部署完成後，你的網站將：
- ✅ 24小時可用（無需本機開機）
- ✅ 自動 HTTPS
- ✅ 全球 CDN 加速
- ✅ 自動部署（每次 push 自動更新）

**後台網址**：`https://your-project.vercel.app/admin`

---

## 📞 需要幫助？

如果遇到問題，請檢查：
1. Vercel 建置日誌
2. 瀏覽器 Console 錯誤
3. Supabase 連接狀態

