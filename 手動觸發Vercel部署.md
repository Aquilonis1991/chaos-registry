# 手動觸發 Vercel 部署最新版本

## 問題
Vercel 正在部署舊的 commit (`6599851`)，但最新的 commit 是 `244325b`（包含管理員限制功能）。

## 解決方法

### 方法 1：在 Vercel Dashboard 手動觸發部署

1. **訪問 Vercel Dashboard**
   - 網址：https://vercel.com/dashboard
   - 登入您的帳號

2. **找到專案**
   - 找到 `chaos-registry` 專案
   - 點擊進入專案詳情

3. **查看部署列表**
   - 點擊 "Deployments" 標籤
   - 查看最新的部署狀態

4. **手動觸發部署**
   - 點擊右上角的 "..." 選單
   - 選擇 "Redeploy"
   - 或者點擊 "Deploy" 按鈕（如果有）
   - **重要**：選擇 "Use latest commit" 或取消勾選 "Use existing Build Cache"

### 方法 2：使用 Vercel CLI（如果已安裝）

```bash
# 安裝 Vercel CLI（如果還沒安裝）
npm i -g vercel

# 登入 Vercel
vercel login

# 部署到生產環境
vercel --prod
```

### 方法 3：創建一個空 commit 觸發部署

```bash
# 創建一個空 commit
git commit --allow-empty -m "Trigger Vercel deployment"

# 推送到 GitHub
git push origin main
```

### 方法 4：檢查 Vercel 設置

1. **檢查 Git 連接**
   - 在 Vercel Dashboard 進入專案設置
   - 檢查 "Git Repository" 是否正確連接
   - 確認連接的是正確的 GitHub 倉庫

2. **檢查自動部署設置**
   - 進入 "Settings" → "Git"
   - 確認 "Production Branch" 設為 `main`
   - 確認 "Auto-deploy" 已啟用

3. **檢查部署觸發器**
   - 進入 "Settings" → "Git"
   - 確認 "Deploy Hooks" 設置正確

## 驗證部署

部署完成後，請：

1. **檢查部署日誌**
   - 在 Vercel Dashboard 查看部署日誌
   - 確認部署的是 commit `244325b` 或更新的版本

2. **測試功能**
   - 清除瀏覽器快取（`Ctrl+Shift+R`）
   - 使用非管理員帳號登入
   - 應該會看到「僅限管理員使用」頁面
   - 打開 Console，應該會看到 `[useAdmin]` 相關日誌

## 如果仍然沒有更新

如果 Vercel 仍然部署舊版本，請：

1. **檢查 GitHub Webhook**
   - 在 GitHub 倉庫設置中檢查 Webhook
   - 確認 Vercel 的 Webhook 是否正常

2. **手動重新連接**
   - 在 Vercel Dashboard 中斷開 Git 連接
   - 重新連接 GitHub 倉庫
   - 這會觸發新的部署

3. **聯繫 Vercel 支援**
   - 如果以上方法都不行，可能需要聯繫 Vercel 支援

---

**建議**：使用方法 3（創建空 commit）最簡單，可以立即觸發 Vercel 重新部署。

