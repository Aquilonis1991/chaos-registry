# 設定 JWT_SECRET 環境變數

## 📋 步驟

### 1. 獲取 JWT Secret

1. **前往 Supabase Dashboard**
   - 網址：https://app.supabase.com/
   - 選擇專案：`epyykzxxglkjombvozhr`

2. **導航到 Settings > API**
   - 在左側選單中點擊 **Settings**（齒輪圖標）
   - 點擊 **API** 標籤

3. **找到並複製 JWT Secret**
   - 在 **Project API keys** 區域下方
   - 找到 **JWT Secret** 欄位
   - 點擊 **Reveal** 或 **Show** 按鈕顯示完整 Secret
   - **複製完整的 JWT Secret**（通常是一長串 Base64 編碼的字串）

### 2. 設定 JWT_SECRET 環境變數

在 PowerShell 中執行以下命令（將 `你的JWT_SECRET值` 替換為實際複製的值）：

```powershell
cd C:\Users\USER\Documents\Mywork\votechaos-main
supabase secrets set JWT_SECRET=你的JWT_SECRET值 --project-ref epyykzxxglkjombvozhr
```

**範例**（請替換為實際值）：
```powershell
supabase secrets set JWT_SECRET=W5GXYqKqbMV4JFCz0ma0cU85//cKkeOlB7ELigyETEb677bLYQjlxTJcPoEuTwQ0Rq7xddIqarlugtX9fzgdSw== --project-ref epyykzxxglkjombvozhr
```

### 3. 驗證設定

執行以下命令確認所有環境變數都已設定：

```powershell
supabase secrets list --project-ref epyykzxxglkjombvozhr
```

應該會看到：
- `TWITTER_CLIENT_ID` ✅
- `TWITTER_CLIENT_SECRET` ✅
- `JWT_SECRET` ✅

### 4. 重新部署 Edge Function

```powershell
supabase functions deploy twitter-auth
```

---

## ⚠️ 注意事項

- JWT Secret 是敏感資訊，請勿分享或提交到 Git
- 確保複製的是完整的 JWT Secret（沒有截斷）
- 確保值沒有多餘的空格或換行
