# GitHub Actions Apple JWT 自動更新設定指南

## 📋 概述

本指南將協助您設定 GitHub Actions 來自動生成和更新 Apple Sign In 的 JWT Token。

**優點**：
- ✅ 完全自動化，不需要本地電腦
- ✅ 每 150 天自動執行（在 JWT 到期前 30 天）
- ✅ 自動建立 GitHub Issue 提醒更新
- ✅ 適合團隊協作

---

## 🚀 快速設定步驟

### 步驟 1：準備必要資訊

請準備以下資訊：

1. **Team ID**：從 Apple Developer Portal 右上角取得
   - 格式：`ABC123DEF4`（10 個字元）

2. **Key ID**：從 Apple Developer Portal Keys 頁面取得
   - 格式：`XYZ789GHI0`（10 個字元）

3. **.p8 檔案內容**：下載的 `AuthKey_XXX.p8` 檔案
   - 打開檔案，複製完整內容（包括 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`）

---

### 步驟 2：設定 GitHub Secrets

1. **前往 GitHub Repository**
   - 訪問您的 GitHub Repository
   - 點擊 **Settings**（設定）

2. **導航到 Secrets**
   - 在左側選單中，點擊 **Secrets and variables** > **Actions**

3. **新增 Secrets**
   點擊 **New repository secret** 按鈕，新增以下三個 Secrets：

   #### Secret 1：`APPLE_TEAM_ID`
   - **Name**：`APPLE_TEAM_ID`
   - **Secret**：您的 Team ID（例如：`ABC123DEF4`）
   - 點擊 **Add secret**

   #### Secret 2：`APPLE_KEY_ID`
   - **Name**：`APPLE_KEY_ID`
   - **Secret**：您的 Key ID（例如：`XYZ789GHI0`）
   - 點擊 **Add secret**

   #### Secret 3：`APPLE_KEY_FILE`
   - **Name**：`APPLE_KEY_FILE`
   - **Secret**：`.p8` 檔案的完整內容
     ```
     -----BEGIN PRIVATE KEY-----
     MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgxc06bXb/D64XE54t
     oFKc2+SK5b2zrp6TSCx+JKI1VSygCgYIKoZIzj0DAQehRANCAARzcBemx7f+5wWP
     pXNq8EQAjnXWMXI51o/Y85FlLVpVIf23ro1Qe+ofH63B8pxh3kTzNRVo7e8Fj5iZ
     xTlEx9GA
     -----END PRIVATE KEY-----
     ```
   - ⚠️ **重要**：必須包含完整的內容，包括 BEGIN 和 END 標記
   - 點擊 **Add secret**

4. **確認 Secrets**
   完成後，您應該看到三個 Secrets：
   - ✅ `APPLE_TEAM_ID`
   - ✅ `APPLE_KEY_ID`
   - ✅ `APPLE_KEY_FILE`

---

### 步驟 3：測試 GitHub Actions

1. **前往 Actions 頁面**
   - 在 GitHub Repository 中，點擊 **Actions** 標籤

2. **找到工作流程**
   - 在左側選單中，找到 **Update Apple JWT Token**
   - 如果沒有看到，可能需要先提交工作流程檔案到 GitHub

3. **手動觸發測試**
   - 點擊 **Update Apple JWT Token** 工作流程
   - 點擊 **Run workflow** 按鈕
   - 選擇分支（通常是 `main` 或 `master`）
   - 點擊 **Run workflow**

4. **查看執行結果**
   - 等待工作流程執行完成（通常需要 1-2 分鐘）
   - 點擊執行記錄查看詳細日誌
   - 確認所有步驟都成功（綠色 ✓）

5. **檢查 GitHub Issue**
   - 執行成功後，會自動建立一個 GitHub Issue
   - Issue 標題：`🔄 Apple JWT Token 需要更新 - [日期]`
   - Issue 內容包含新的 JWT Token

---

### 步驟 4：更新 Supabase

1. **取得 JWT Token**
   - 從自動建立的 GitHub Issue 中複製 JWT Token
   - 或從工作流程的日誌中取得

2. **更新 Supabase**
   - 前往 [Supabase Dashboard](https://app.supabase.com/)
   - 選擇專案：`epyykzxxglkjombvozhr`
   - 導航到 **Authentication** > **Providers** > **Apple**
   - 將 JWT Token 貼到 **Secret Key (for OAuth)** 欄位
   - 點擊 **Save**

3. **測試 Apple 登入**
   - 前往應用程式登入頁面
   - 點擊「使用 Apple 登入」按鈕
   - 確認登入功能正常

---

## 📅 自動執行排程

工作流程會自動在以下時間執行：

- **排程**：每 5 個月的第 1 天（約每 150 天）
- **時間**：UTC 00:00（台灣時間 08:00）
- **手動觸發**：隨時可以手動觸發

### Cron 語法說明

```yaml
- cron: '0 0 1 */5 *'
```

- `0 0`：00:00（UTC）
- `1`：每月的第 1 天
- `*/5`：每 5 個月
- `*`：任何星期

---

## 🔍 故障排除

### 問題 1：工作流程執行失敗

**可能原因**：
- Secrets 未正確設定
- .p8 檔案格式不正確
- Team ID 或 Key ID 錯誤

**解決方案**：
1. 檢查 GitHub Secrets 是否正確設定
2. 確認 .p8 檔案內容包含 BEGIN 和 END 標記
3. 查看工作流程日誌中的錯誤訊息

### 問題 2：無法建立 GitHub Issue

**可能原因**：
- Repository 沒有 Issues 功能
- 權限不足

**解決方案**：
1. 前往 Repository Settings > General
2. 確認 **Features** 中的 **Issues** 已啟用
3. 確認 GitHub Actions 有建立 Issue 的權限

### 問題 3：JWT Token 格式不正確

**可能原因**：
- .p8 檔案內容不完整
- 複製時遺漏了部分內容

**解決方案**：
1. 重新檢查 .p8 檔案內容
2. 確認包含完整的 BEGIN 和 END 標記
3. 確認沒有多餘的空格或換行

---

## ✅ 檢查清單

### 設定前
- [ ] Team ID 已取得
- [ ] Key ID 已取得
- [ ] .p8 檔案已下載
- [ ] .p8 檔案內容已複製

### 設定中
- [ ] GitHub Secrets 已設定（3 個）
- [ ] 工作流程檔案已提交到 GitHub
- [ ] 工作流程已測試執行

### 設定後
- [ ] 工作流程執行成功
- [ ] GitHub Issue 已建立
- [ ] JWT Token 已更新到 Supabase
- [ ] Apple 登入功能測試正常

---

## 📝 工作流程說明

### 執行步驟

1. **Checkout repository**：取得程式碼
2. **Setup Node.js**：設定 Node.js 環境
3. **Install dependencies**：安裝 npm 套件
4. **Create secrets directory**：建立 secrets 資料夾
5. **Write Apple private key**：將 .p8 檔案寫入 secrets 資料夾
6. **Generate JWT Token**：執行腳本生成 JWT Token
7. **Read generated token**：讀取生成的 JWT Token
8. **Create GitHub Issue**：建立 Issue 並包含 JWT Token
9. **Cleanup**：清理臨時檔案

### 安全性

- ✅ Secrets 不會顯示在日誌中
- ✅ 臨時檔案會在執行後自動刪除
- ✅ .p8 檔案不會提交到 Git
- ✅ JWT Token 只會顯示在 GitHub Issue 中

---

## 🔔 提醒設定

### GitHub Notifications

1. **啟用通知**
   - 前往 GitHub Settings > Notifications
   - 啟用 **Issues** 通知

2. **設定提醒**
   - 當 GitHub Issue 建立時，您會收到通知
   - 可以設定 Email 或 GitHub 通知

### 手動提醒

建議在行事曆中設定提醒：
- **時間**：每 150 天
- **內容**：檢查 Apple JWT Token 是否需要更新

---

## 🎯 最佳實踐

1. **定期檢查**
   - 每 150 天檢查一次 GitHub Issue
   - 確認 JWT Token 已更新到 Supabase

2. **備份資訊**
   - 保留 Team ID 和 Key ID 的備份
   - 保留 .p8 檔案的備份（安全儲存）

3. **監控執行**
   - 定期檢查 GitHub Actions 執行狀態
   - 確認工作流程正常執行

4. **團隊協作**
   - 通知團隊成員 JWT Token 更新流程
   - 設定團隊通知規則

---

## 📞 需要協助？

如果遇到問題：

1. **檢查工作流程日誌**
   - 前往 GitHub Actions 頁面
   - 查看失敗的執行記錄
   - 檢查錯誤訊息

2. **驗證 Secrets**
   - 確認所有 Secrets 已正確設定
   - 確認格式正確

3. **測試腳本**
   - 在本地執行 `node scripts/update-apple-jwt.cjs`
   - 確認腳本可以正常執行

---

## 🎉 完成！

設定完成後，GitHub Actions 會：
- ✅ 每 150 天自動生成新的 JWT Token
- ✅ 自動建立 GitHub Issue 提醒您更新
- ✅ 完全自動化，無需手動操作

您只需要：
1. 定期檢查 GitHub Issue
2. 複製 JWT Token
3. 更新到 Supabase

就是這麼簡單！
