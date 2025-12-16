# GitHub Pages 設定指南

## 📋 概述

本指南將協助您將 ChaosRegistry 的商家資訊頁面部署到 GitHub Pages，以便通過 META 商家驗證。

## ✅ 已準備的檔案

已為您創建以下檔案：
- `docs/index.html` - 包含所有必要資訊的商家頁面
- `docs/.nojekyll` - 確保 GitHub Pages 正確處理檔案

## 🚀 部署步驟

### 步驟 1：確認檔案已提交到 Git

```bash
# 檢查檔案是否存在
ls docs/index.html
ls docs/.nojekyll

# 如果檔案存在，將它們加入 Git
git add docs/index.html docs/.nojekyll
git commit -m "Add GitHub Pages for META verification"
git push
```

### 步驟 2：在 GitHub 啟用 GitHub Pages

1. **前往您的 GitHub Repository**
   - 開啟 `https://github.com/您的用戶名/votechaos-main`（或您的 repository 名稱）

2. **進入 Settings**
   - 點擊 Repository 頁面右上角的 **Settings**

3. **找到 Pages 設定**
   - 在左側選單中找到 **Pages**（通常在底部）

4. **設定 Source**
   - 在 **Source** 下拉選單中選擇 **Deploy from a branch**
   - 在 **Branch** 下拉選單中選擇 **main**（或您的預設分支）
   - 在 **Folder** 下拉選單中選擇 **/docs**
   - 點擊 **Save**

5. **等待部署**
   - GitHub 會自動部署您的頁面
   - 通常需要 1-2 分鐘
   - 部署完成後，您會看到一個綠色勾勾和網址

### 步驟 3：取得 GitHub Pages URL

部署完成後，您的 GitHub Pages URL 格式為：
```
https://您的用戶名.github.io/votechaos-main/
```

或如果您的 Repository 名稱與用戶名相同：
```
https://您的用戶名.github.io/
```

**範例**：
- 如果您的用戶名是 `chaosregistry`，Repository 名稱是 `votechaos-main`
- 則 URL 為：`https://chaosregistry.github.io/votechaos-main/`

## 📝 頁面內容

頁面包含以下資訊（符合 META 驗證要求）：

✅ **App 名稱**：ChaosRegistry / 不理性登記處  
✅ **Email 聯絡方式**：support@votechaos.com  
✅ **App 介紹**：簡短兩三句說明  
✅ **隱私權政策連結**：連結到 Vercel 部署的隱私權政策頁面  
✅ **使用者條款連結**：連結到 Vercel 部署的使用者條款頁面  

## 🔗 連結說明

頁面中的連結會指向：
- **隱私權政策**：`https://chaos-registry.vercel.app/privacy`
- **使用者條款**：`https://chaos-registry.vercel.app/terms`
- **關於我們**：`https://chaos-registry.vercel.app/about`

這些連結會在新分頁開啟，確保使用者可以查看完整的法律文件。

## ✅ 驗證檢查清單

部署完成後，請確認：

- [ ] GitHub Pages 已啟用
- [ ] 頁面可以正常訪問（無 404 錯誤）
- [ ] 所有連結都可以正常開啟
- [ ] 頁面顯示正確的 App 名稱
- [ ] Email 聯絡方式正確顯示
- [ ] App 介紹文字清晰
- [ ] 隱私權政策連結正常
- [ ] 使用者條款連結正常

## 🎯 在 META 驗證中使用

1. **登入 META Business Manager**
2. **前往商家驗證頁面**
3. **在「新增商家詳細資料」中**：
   - **網站 URL**：輸入您的 GitHub Pages URL
     - 例如：`https://您的用戶名.github.io/votechaos-main/`
4. **提交驗證**

## 🔄 更新頁面內容

如果需要更新頁面內容：

1. **編輯 `docs/index.html`**
2. **提交變更**：
   ```bash
   git add docs/index.html
   git commit -m "Update GitHub Pages content"
   git push
   ```
3. **等待自動部署**（通常 1-2 分鐘）

## 🐛 常見問題

### 問題 1：頁面顯示 404

**解決方法**：
- 確認 GitHub Pages 已啟用
- 確認 Source 設定為 `/docs` 資料夾
- 確認 `docs/index.html` 檔案存在
- 等待幾分鐘讓 GitHub 完成部署

### 問題 2：樣式沒有顯示

**解決方法**：
- 確認 `docs/.nojekyll` 檔案存在（防止 Jekyll 處理）
- 清除瀏覽器快取
- 檢查 HTML 中的 CSS 是否正確

### 問題 3：連結無法開啟

**解決方法**：
- 確認 Vercel 部署的頁面可以正常訪問
- 檢查連結 URL 是否正確
- 確認連結使用 `target="_blank"` 和 `rel="noopener noreferrer"`

## 📞 需要協助？

如果遇到任何問題，請檢查：
1. GitHub Pages 設定是否正確
2. 檔案是否已正確提交到 Git
3. 分支名稱是否正確（通常是 `main` 或 `master`）

---

**完成後，您就可以使用 GitHub Pages URL 進行 META 商家驗證了！** 🎉



