# USB 轉移資料 + Git 連線 詳細步驟

用 USB 帶設定與（可選）專案備份，到 Mac 後仍用 Git 取得／更新程式碼。以下分「在 Windows 準備 USB」與「在 Mac 還原並連 Git」兩部分。

---

## 一、在 Windows 準備 USB

### 1. 在 USB 建立一個資料夾

例如在 USB 根目錄建立：**`ChaosRegistry-Mac轉移`**（名稱可自訂），以下檔案都放進這個資料夾。

### 2. 一定要帶的：環境變數與密鑰（無法從 Git 取得）

| 帶什麼 | 在 Windows 的做法 | 在 USB 裡放成什麼 |
|--------|-------------------|-------------------|
| **.env.local 的內容** | 用記事本打開 `votechaos-main\.env.local`，全選複製 | 在 USB 資料夾裡新增文字檔 **`env-local內容.txt`**，貼上內容後儲存 |
| **secrets 資料夾**（若有使用） | 複製整個 `votechaos-main\secrets` 資料夾 | 貼到 USB 的 `ChaosRegistry-Mac轉移\secrets\` |

這樣到 Mac 後可以還原 `.env.local` 和 `secrets/`，不會依賴 Git。

### 3. 可選：整份專案備份（方便離線或 Git 有問題時用）

若希望 USB 也有一份「程式碼備份」：

- 複製整個 **`votechaos-main`** 資料夾到 USB 的 `ChaosRegistry-Mac轉移\` 內。
- **建議先排除**（可縮小體積、避免路徑問題）：
  - `node_modules`
  - `dist`
  - `android\app\build`
  - `android\.gradle`
  - `ios\App\build`
  - `ios\App\Pods`
  - `native-ad-plugin\android\build`
  - 根目錄的 `*.aab`、`*.apk`（若有）

到 Mac 後可以選擇：**只從 Git clone**，或 **用 USB 這份當起點再連 Git**（下面會寫兩種做法）。

### 4. 檢查 USB 內容（建議）

確認 USB 的 `ChaosRegistry-Mac轉移` 裡至少有：

- `env-local內容.txt`（.env.local 的完整內容）
- 若有使用：`secrets` 資料夾（內含 .p8 等檔案）
- 若已複製專案：`votechaos-main` 資料夾（可無 node_modules / build）

---

## 二、在 Mac 還原並連結 Git

到 Mac 後有兩種方式：**A. 以 Git 為主（建議）**、**B. 以 USB 專案為主再連 Git**。擇一即可。

---

### 方式 A：以 Git 為主（建議）

完全用 GitHub 上的程式碼，USB 只拿來還原設定。

#### 步驟 1：接上 USB，記住路徑

- 插入 USB，等它出現在 Finder。
- 點選 USB 磁碟，找到 **`ChaosRegistry-Mac轉移`**。
- 可拖到「位置」或記住路徑，例如：`/Volumes/你的USB名稱/ChaosRegistry-Mac轉移`。

#### 步驟 2：在 Mac 上 clone 專案

打開 **終端機**，執行（路徑可改成你要放專案的地方）：

```bash
cd ~/Documents
git clone https://github.com/Aquilonis1991/chaos-registry.git votechaos-main
cd votechaos-main
```

若要建 iOS，可切到 ios 分支：

```bash
git checkout ios
```

#### 步驟 3：從 USB 還原 .env.local

- 在 Finder 打開 USB 的 `ChaosRegistry-Mac轉移`，打開 **`env-local內容.txt`**，全選複製。
- 在終端機執行（在專案目錄 `votechaos-main` 下）：

```bash
cd ~/Documents/votechaos-main
nano .env.local
```

- 貼上剛複製的內容，按 `Ctrl+O` 儲存，`Enter` 確認，`Ctrl+X` 離開。
- 或用 VS Code / 其他編輯器在 `votechaos-main` 根目錄**新增檔案** `.env.local`，貼上同一份內容後儲存。

#### 步驟 4：從 USB 還原 secrets（若有）

在終端機執行（請把 `你的USB名稱` 改成實際名稱，路徑以 Finder 顯示為準）：

```bash
cp -R "/Volumes/你的USB名稱/ChaosRegistry-Mac轉移/secrets" ~/Documents/votechaos-main/
```

若 USB 沒有 `secrets` 就跳過此步。

#### 步驟 5：安裝依賴與建置（例如 iOS）

```bash
cd ~/Documents/votechaos-main
npm install
npm run build
npx cap sync ios
cd ios/App && pod install && cd ../..
npm run ios
```

之後在 Mac 上要更新程式碼，一律用 Git：

```bash
cd ~/Documents/votechaos-main
git pull origin ios
```

再視需要執行 `npm run build`、`npx cap sync ios`、`pod install`。

---

### 方式 B：以 USB 專案為主，再連 Git

若你在 USB 有複製整份 `votechaos-main`，想直接拿這份當專案，再和 GitHub 同步。

#### 步驟 1：把專案從 USB 複製到 Mac

- 在 Finder 把 USB 的 **`ChaosRegistry-Mac轉移\votechaos-main`** 整份複製到例如 **`~/Documents/votechaos-main`**。
- 不要直接在 USB 上開發（速度慢且可能損壞）。

#### 步驟 2：確認有沒有 .git

在終端機執行：

```bash
cd ~/Documents/votechaos-main
ls -la .git
```

- **若有 `.git` 資料夾**：表示是從 Windows 複製來的 Git 專案，直接做步驟 3。
- **若沒有 `.git`**：表示是精簡備份，要用 Git 就改走「方式 A」在 Mac 上 `git clone`，再把 USB 的 `env-local內容.txt` 和 `secrets` 還原進去。

#### 步驟 3：設定遠端並更新（有 .git 時）

```bash
cd ~/Documents/votechaos-main
git remote -v
```

若沒有 `origin` 或網址不對，設定為 GitHub：

```bash
git remote add origin https://github.com/Aquilonis1991/chaos-registry.git
```

或改網址：

```bash
git remote set-url origin https://github.com/Aquilonis1991/chaos-registry.git
```

抓取並與遠端同步（以 ios 為例，可改成 main 或 android）：

```bash
git fetch origin
git checkout ios
git branch --set-upstream-to=origin/ios ios
git pull origin ios
```

若有衝突再依提示處理。

#### 步驟 4：還原 .env.local 與 secrets

- **.env.local**：若 USB 有 `env-local內容.txt`，在專案根目錄新增 `.env.local`，內容貼上與該檔相同。
- **secrets**：從 USB 的 `ChaosRegistry-Mac轉移/secrets` 複製到 `~/Documents/votechaos-main/secrets`。

#### 步驟 5：安裝依賴與建置

同方式 A 的步驟 5（`npm install` → `npm run build` → `npx cap sync ios` → `pod install` → `npm run ios`）。

之後要更新程式碼：

```bash
git pull origin ios
```

再視需要建置與 sync。

---

## 三、之後在 Mac 上日常使用 Git

- **拉最新程式碼**：`git pull origin ios`（或你用的分支）
- **建置前**：`npm run build` → `npx cap sync ios` → `cd ios/App && pod install`
- **不要**把 `.env.local`、`secrets/` 加入 Git；它們只保留在本機＋用 USB/雲端備份。

---

## 四、快速對照：USB 要放什麼、Mac 要做什麼

| 階段 | 內容 |
|------|------|
| **USB 必備** | `env-local內容.txt`（.env.local 全文）、若有則 `secrets` 資料夾 |
| **USB 可選** | 整份 `votechaos-main`（可排除 node_modules、dist、各 build） |
| **Mac 必做** | 1) 用 Git clone 或 2) 從 USB 複製專案並設好 remote → 2) 還原 .env.local 與 secrets → 3) npm install、build、cap sync、pod install |

照以上步驟，用 USB 轉移設定與（可選）專案備份，同時在 Mac 用 Git 取得／更新程式碼即可。
