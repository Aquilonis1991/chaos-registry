# Apple JWT Token 自動更新設定指南

## 📋 概述

Apple Sign In 的 JWT Token 有效期為 180 天，需要定期更新。本指南提供多種自動更新方案。

---

## 🎯 方案選擇

### 方案 1：Windows Task Scheduler（推薦 - Windows 用戶）

**優點**：
- ✅ 不需要額外服務
- ✅ 完全本地控制
- ✅ 設定簡單

**缺點**：
- ❌ 需要電腦開機才能執行
- ❌ 需要手動更新 Supabase

---

### 方案 2：GitHub Actions（推薦 - 使用 GitHub）

**優點**：
- ✅ 完全自動化
- ✅ 不需要本地電腦
- ✅ 可以自動更新 Supabase（需要設定）

**缺點**：
- ❌ 需要 GitHub 帳號
- ❌ 需要設定 Secrets

---

### 方案 3：Supabase Edge Function + Cron（進階）

**優點**：
- ✅ 完全自動化
- ✅ 可以直接更新 Supabase
- ✅ 不需要外部服務

**缺點**：
- ❌ 需要實作 Supabase Management API
- ❌ 設定較複雜

---

## 🪟 方案 1：Windows Task Scheduler

### 步驟 1：建立批次檔

建立 `scripts/update-apple-jwt.bat`：

```batch
@echo off
cd /d "%~dp0\.."
node scripts/update-apple-jwt.cjs
pause
```

### 步驟 2：設定環境變數（可選）

在批次檔中設定環境變數，或使用系統環境變數：

```batch
@echo off
set APPLE_TEAM_ID=YOUR_TEAM_ID
set APPLE_KEY_ID=YOUR_KEY_ID
cd /d "%~dp0\.."
node scripts/update-apple-jwt.cjs
pause
```

### 步驟 3：建立 Windows 工作排程

1. 打開「工作排程器」（Task Scheduler）
2. 點擊「建立基本工作」
3. 設定：
   - **名稱**：`Update Apple JWT Token`
   - **描述**：每 150 天自動更新 Apple JWT Token
   - **觸發程序**：依排程
   - **頻率**：每 150 天（在 JWT 到期前 30 天更新）
4. **動作**：啟動程式
   - **程式或腳本**：`C:\Users\USER\Documents\Mywork\votechaos-main\scripts\update-apple-jwt.bat`
5. 完成

### 步驟 4：測試

1. 在「工作排程器」中，找到建立的工作
2. 右鍵 > 「執行」
3. 確認腳本正常執行

---

## 🐙 方案 2：GitHub Actions

### 步驟 1：建立 GitHub Actions 工作流程

建立 `.github/workflows/update-apple-jwt.yml`：

```yaml
name: Update Apple JWT Token

on:
  schedule:
    # 每 150 天執行一次（在 JWT 到期前 30 天）
    - cron: '0 0 1 */5 *'  # 每 5 個月執行一次
  workflow_dispatch:  # 允許手動觸發

jobs:
  update-jwt:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Generate JWT Token
        env:
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_KEY_ID: ${{ secrets.APPLE_KEY_ID }}
          APPLE_KEY_FILE: ${{ secrets.APPLE_KEY_FILE }}
        run: |
          # 將 .p8 檔案內容寫入臨時檔案
          echo "$APPLE_KEY_FILE" > secrets/apple-sign-in-key.p8
          node scripts/update-apple-jwt.cjs
      
      - name: Create Issue with New Token
        uses: actions/github-script@v6
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const fs = require('fs');
            const token = fs.readFileSync('secrets/apple-jwt-token.txt', 'utf8');
            
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🔄 Apple JWT Token 需要更新',
              body: `新的 JWT Token 已生成，請更新 Supabase 設定。\n\n\`\`\`\n${token}\n\`\`\`\n\n請前往 Supabase Dashboard > Authentication > Providers > Apple 更新 Secret Key。`
            });
```

### 步驟 2：設定 GitHub Secrets

在 GitHub Repository > Settings > Secrets and variables > Actions 中新增：

- `APPLE_TEAM_ID`：您的 Team ID
- `APPLE_KEY_ID`：您的 Key ID
- `APPLE_KEY_FILE`：`.p8` 檔案的完整內容

### 步驟 3：測試

1. 前往 GitHub Actions 頁面
2. 找到 "Update Apple JWT Token" 工作流程
3. 點擊 "Run workflow" 手動觸發
4. 確認執行成功

---

## 🔧 方案 3：Supabase Edge Function（進階）

### 步驟 1：建立 Edge Function

建立 `supabase/functions/update-apple-jwt/index.ts`：

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

serve(async (req) => {
  try {
    // 從環境變數取得配置
    const teamId = Deno.env.get('APPLE_TEAM_ID');
    const keyId = Deno.env.get('APPLE_KEY_ID');
    const clientId = 'com.votechaos.app.services';
    const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
    
    // 生成 JWT Token（需要實作 JWT 生成邏輯）
    // ... JWT 生成代碼 ...
    
    // 使用 Supabase Management API 更新 Provider
    // 注意：這需要 Supabase Management API，可能需要額外設定
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

### 步驟 2：設定 Supabase Cron

在 Supabase Dashboard > Database > Cron Jobs 中設定定期執行。

---

## 📅 建議的更新頻率

- **JWT 有效期**：180 天
- **建議更新頻率**：每 150 天（在到期前 30 天更新）
- **緊急更新**：如果 JWT 過期，立即手動更新

---

## ✅ 檢查清單

### Windows Task Scheduler
- [ ] 批次檔已建立
- [ ] 環境變數已設定（可選）
- [ ] 工作排程已建立
- [ ] 測試執行成功

### GitHub Actions
- [ ] 工作流程檔案已建立
- [ ] GitHub Secrets 已設定
- [ ] 測試執行成功

### 一般檢查
- [ ] JWT Token 生成成功
- [ ] 已手動或自動更新 Supabase
- [ ] 測試 Apple 登入功能正常

---

## 🚨 重要提醒

1. **安全性**：
   - 不要將 `.p8` 檔案提交到 Git
   - 不要將 JWT Token 提交到 Git
   - 使用環境變數或 Secrets 儲存敏感資訊

2. **備份**：
   - 保留 `.p8` 檔案備份
   - 記錄 Team ID 和 Key ID

3. **監控**：
   - 設定提醒（在 JWT 到期前 30 天）
   - 定期檢查 JWT 是否正常運作

---

## 📞 需要協助？

如果遇到問題，請檢查：
1. 環境變數是否正確設定
2. 檔案路徑是否正確
3. 執行權限是否足夠
4. 日誌訊息中的錯誤資訊
