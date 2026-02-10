# Windows 移轉至 Mac：打包與設定指南

要將專案從 Windows 帶到 Mac 做 iOS 建置，建議用 **Git** 同步程式碼，再在 Mac 上**手動帶過去**不能進版控的設定檔。

---

## 一、建議做法：用 Git 同步程式碼

### 在 Windows（移轉前）要做的事

1. **確認變更都有提交**
   ```powershell
   cd C:\Users\USER\Documents\Mywork\votechaos-main
   git status
   git add -A
   git commit -m "chore: sync before Mac migration"
   ```

2. **推送到遠端**（GitHub / GitLab / 其他）
   ```powershell
   git push origin main
   ```
   若分支名是 `master` 或別的，改成對應分支名。

3. **不要提交的檔案**（已在 .gitignore，確認沒被加入即可）
   - `.env.local`（環境變數，含 Supabase key）
   - `secrets/`（Apple 金鑰、JWT 等）
   - `node_modules/`、`dist/`
   - `android/app/build/`、`ios/App/build/` 等建置產物

---

## 二、需要「手動帶去 Mac」的內容（不進 Git）

這些檔案**不會**透過 Git 同步，請用**安全方式**自己帶到 Mac（例如 USB、加密雲端、密碼管理器的備註）。

| 項目 | 在 Windows 的位置 | 到 Mac 後放哪裡 |
|------|-------------------|------------------|
| 前端環境變數 | `votechaos-main\.env.local` | 專案根目錄 `votechaos-main/.env.local` |
| 密鑰資料夾（若有） | `votechaos-main\secrets\` | 專案根目錄 `votechaos-main/secrets/` |

**.env.local 內容參考**（`env.example.txt` 的實際值）：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PUBLIC_SITE_URL`、`VITE_APP_DEEP_LINK`、`VITE_APP_DOWNLOAD_URL`（若有用到）

**secrets/ 常見檔案**（依你實際有使用的為準）：

- `apple-sign-in-key.p8`（Apple Sign In）
- `apple-jwt-token.txt`（若你有存一份）
- 其他僅本機使用的金鑰檔

**如何帶過去**（任選一種）：

- 複製 `.env.local` 內容貼到 Mac 上的新檔。
- 把 `secrets` 資料夾壓縮（加密）後用 USB 或雲端傳到 Mac 再解壓到專案下。

---

## 三、在 Mac 上第一次設定

### 1. 安裝必要軟體

| 軟體 | 用途 | 安裝方式 |
|------|------|----------|
| Node.js 18+ | 建置前端、跑 npm | [nodejs.org](https://nodejs.org/) 或 `brew install node` |
| Xcode | iOS 建置、模擬器 | App Store 安裝，並打開一次完成授權 |
| Xcode Command Line Tools | 指令列建置 | `xcode-select --install` |
| CocoaPods | iOS 依賴 | `sudo gem install cocoapods` 或 `brew install cocoapods` |
| Git | 拉專案 | 通常已內建，或 `xcode-select --install` 會帶入 |

檢查：

```bash
node --version    # v18+
pod --version     # 有版本即可
xcodebuild -version
```

### 2. 取得專案

**方式 A：從遠端 clone（建議）**

```bash
cd ~/Documents   # 或你習慣的目錄
git clone https://github.com/你的帳號/你的repo.git votechaos-main
cd votechaos-main
```

**方式 B：用隨身碟 / 網路複製整個資料夾**

- 在 Windows 複製整個 `votechaos-main` 資料夾（可先刪除 `node_modules`、`dist`、`android/app/build` 以縮小體積）。
- 到 Mac 後解壓或複製到例如 `~/Documents/votechaos-main`。

### 3. 還原「手動帶過去」的設定

- 在專案根目錄建立 `.env.local`，內容從 Windows 複製過來（或照 `env.example.txt` 填實際值）。
- 若有 `secrets/`，放到專案根目錄下，結構與 Windows 一致（例如 `secrets/apple-sign-in-key.p8`）。

### 4. 安裝依賴與同步 iOS

```bash
cd ~/Documents/votechaos-main   # 換成你的路徑

npm install
npm run build
npx cap sync ios
cd ios/App && pod install && cd ../..
```

### 5. 用 Xcode 建置 / 跑模擬器

```bash
npm run ios
```

或手動：

```bash
npx cap open ios
```

在 Xcode 裡選模擬器或實機，再按 Run (⌘R)。

---

## 四、若不用 Git：整包複製清單

若你**不打算用 Git**，在 Windows 可這樣打包：

**建議複製：**

- 整個 `votechaos-main` 資料夾**除了**下面「建議排除」的項目。

**建議排除（可大幅縮小體積、避免路徑問題）：**

- `node_modules/`
- `dist/`、`dist-ssr/`
- `android/app/build/`、`android/.gradle/`
- `ios/App/build/`、`ios/App/Pods/`、`ios/App/App.xcworkspace` 以外的 Pod 相關快取
- `native-ad-plugin/android/build/`
- `.git`（若不想在 Mac 用同一個 repo 可刪，但保留較方便後續用 Git）

**一定要另外帶到 Mac：**

- `.env.local`（若沒放進複製的資料夾，就手動建一份）
- `secrets/`（若有使用）

到 Mac 後：

1. 解壓 / 複製到目標目錄（例如 `~/Documents/votechaos-main`）。
2. 補上 `.env.local` 與 `secrets/`（若未包含在包內）。
3. 從上面「三、在 Mac 上第一次設定」的 **4. 安裝依賴與同步 iOS** 開始做。

---

## 五、檢查清單（Mac 端）

| 步驟 | 項目 |
|------|------|
| 1 | Node.js 18+、Xcode、CocoaPods 已安裝 |
| 2 | 專案已存在（clone 或複製） |
| 3 | 專案根目錄有 `.env.local`，內容正確 |
| 4 | 若有使用，`secrets/` 已放在專案根目錄 |
| 5 | 已執行 `npm install` |
| 6 | 已執行 `npm run build` |
| 7 | 已執行 `npx cap sync ios` |
| 8 | 已執行 `cd ios/App && pod install` |
| 9 | `npm run ios` 或 `npx cap open ios` 可開啟 Xcode並建置 |

---

## 六、常見問題

**Q: 為什麼不把 .env.local 和 secrets 一起用 Git 推上去？**  
A: 這些檔案含金鑰與密碼，不應進版控。用「手動帶過去」或密碼管理器／加密雲端較安全。

**Q: Mac 上沒有 Android 建置需求，可以刪掉 android 資料夾嗎？**  
A: 可保留不影響；若確定永遠不在這台 Mac 建 Android，可刪。iOS 建置只依賴 `ios/` 與 `npm run build` + `cap sync ios`。

**Q: pod install 報錯或權限問題？**  
A: 先執行 `sudo gem install cocoapods`，再在 `ios/App` 下執行 `pod install`。若用 M1/M2，可改用 `brew install cocoapods` 後再試。

**Q: 路徑或編碼問題（中文檔名、路徑）？**  
A: 專案與路徑盡量用英文；`.env.local` 用 UTF-8 儲存。

完成以上步驟後，在 Mac 上就可以用同一套設定繼續開發並進行 iOS 建置。
