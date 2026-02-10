# Mac 還原與建置 - 完整步驟（對話精華）

本檔案整理自 Cursor 對話，方便在 Mac 上照著做，無需重開聊天。

---

## 一、USB 裡有什麼

- **ChaosRegistry-Mac轉移** 資料夾內：
  - `env-local-content.txt`：.env.local 的完整內容
  - `secrets/`：密鑰（apple-jwt-token.txt、apple-sign-in-key.p8、google-oauth-client.json 等）
  - `README-Mac還原說明.txt`：簡要還原說明

---

## 二、Mac 上取得專案（Git）

```bash
cd ~/Documents
git clone https://github.com/Aquilonis1991/chaos-registry.git votechaos-main
cd votechaos-main
git checkout ios
```

---

## 三、還原 .env.local

### 方法 A：終端機一鍵複製（推薦）

USB 名稱在 Finder 左側看得到（例如 `USBDRIVE`），替換下面指令裡的 `你的USB名稱`：

```bash
cd ~/Documents/votechaos-main
cp "/Volumes/你的USB名稱/ChaosRegistry-Mac轉移/env-local-content.txt" .env.local
cat .env.local
```

有看到內容就表示成功。

### 方法 B：手動新增並貼上

1. 用 Finder 打開 USB → `ChaosRegistry-Mac轉移` → 雙擊 `env-local-content.txt`，全選（⌘+A）複製（⌘+C）。
2. 在專案根目錄新增 `.env.local`：
   - **VS Code**：在 votechaos-main 左側右鍵 → 新增檔案 → 檔名輸入 `.env.local` → 貼上（⌘+V）→ 儲存（⌘+S）。
   - **終端機**：`cd ~/Documents/votechaos-main` → `touch .env.local` → `open -e .env.local`，在「文字編輯」中貼上後儲存。
3. 確認：`ls -la ~/Documents/votechaos-main/.env.local` 有列出檔案即可。

**注意**：檔名是 `.env.local`（前面有一點），且要與 `package.json` 同一層。

---

## 四、還原 secrets

在終端機執行（把 `你的USB名稱` 換成實際名稱）：

```bash
cp -R "/Volumes/你的USB名稱/ChaosRegistry-Mac轉移/secrets" ~/Documents/votechaos-main/
```

---

## 五、安裝依賴與建置 iOS

```bash
cd ~/Documents/votechaos-main
npm install
npm run build
npx cap sync ios
cd ios/App && pod install && cd ../..
npm run ios
```

之後要更新程式碼：`git pull origin ios`，再視需要執行 `npm run build`、`npx cap sync ios`、`pod install`。

---

## 六、USB 格式化（若還沒做）

- **建議格式**：**exFAT**（Windows 與 Mac 都可讀寫）
- Windows：磁碟右鍵 → 格式化 → 檔案系統選 exFAT。
- Mac：磁碟工具程式 → 選擇 USB → 清除 → 格式選 ExFAT。

---

## 七、相關文件（專案內）

- **USB轉移與Git連線步驟.md**：USB 準備與兩種還原方式（以 Git 為主 / 以 USB 專案為主）
- **Windows移轉Mac_打包與設定指南.md**：整體移轉與 Mac 環境安裝
- **Mac移轉前準備清單.md**：出發前勾選清單

---

*此檔案可隨專案一起用 Git 拉下來，在 Mac 上直接打開照做即可。*
