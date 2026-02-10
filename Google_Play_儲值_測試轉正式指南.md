# Google Play 儲值：從測試線路開啟正式

目前儲值若仍在「測試線路」（僅內部／封閉／開放測試軌道、或僅授權測試人員可買），要改為正式收費，需完成以下三部分。

---

## 一、Google Play Console：應用程式上架到「正式版」

儲值要對一般使用者收費，應用程式必須有**正式版（Production）**發布，而不只是測試軌道。

### 1. 建立正式版發布

1. 登入 [Google Play Console](https://play.google.com/console/)。
2. 選取您的應用程式。
3. 左側 **「發布」** → **「正式」**（或「生產」）。
4. 若尚未有正式版：
   - 點 **「建立新版本」**（或「建立正式版」）。
   - 上傳與測試時相同的 **AAB**（或新版本號的 AAB）。
   - 填寫**版本名稱**、**版本說明**。
   - 若有「應用程式簽名」提示，依畫面完成（建議使用 Google 代管簽名）。
5. 檢查無誤後，點 **「審查版本」** → **「開始推出正式版」**。
6. 審核通過後，應用程式會對一般使用者開放；此時在正式版安裝的 App 內購買即為**正式線路**（會實際扣款）。

### 2. 僅在測試軌道時

- 若目前只有**內部測試／封閉測試／開放測試**，一般使用者無法從 Play 商店安裝，或安裝的是測試版，儲值行為會依測試設定（例如授權測試人員不扣款）。
- **開啟正式** = 至少有一個**正式版**已上架並可供下載；不需關閉測試軌道，但正式收費以「從正式版管道安裝的 App」為準。

---

## 二、應用程式內產品：確保為「啟用」且可售

1. Play Console 左側 **「營利」** → **「產品」** → **「應用程式內產品」**。
2. 確認四個產品皆存在且狀態為 **「啟用」**：
   - `token_pack_small`
   - `token_pack_medium`
   - `token_pack_large`
   - `token_pack_xlarge`
3. 若為「草稿」或「已停用」，請編輯並改為 **「啟用」**、儲存。
4. 產品 ID 必須與程式內一致（`src/lib/purchase.ts` 的 `PRODUCT_ID_MAP`），且正式版上架後，這些產品會自動在正式環境可購買。

---

## 三、後端驗證改為正式（Supabase Edge Function）

目前 `verify-google-play-purchase` 若未設定 Google Service Account，只會做基本檢查（例如 purchaseToken 格式），**正式環境建議改為呼叫 Google Play Developer API** 做真實驗證。

### 1. 啟用 Google Play Android Developer API

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)。
2. 選取與 Play Console 連結的專案（或建立專案並與 Play 連結）。
3. **「API 和服務」** → **「程式庫」** → 搜尋 **「Google Play Android Developer API」** → **啟用**。

### 2. 建立 Service Account 並取得金鑰

1. **「API 和服務」** → **「憑證」** → **「建立憑證」** → **「服務帳戶」**。
2. 名稱可填 `play-billing-verifier`，建立後進入該服務帳戶。
3. **「金鑰」** → **「新增金鑰」** → **「建立新金鑰」** → 選 **JSON**，下載金鑰檔。
4. 記下 JSON 內的：
   - `client_email`（例如 `xxx@xxx.iam.gserviceaccount.com`）
   - `private_key`（整段 `-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----`）

### 3. 在 Play Console 授權此 Service Account

1. [Google Play Console](https://play.google.com/console/) → 選取應用程式。
2. **「設定」** → **「API 存取權」**（或「開發者帳戶」→「使用者與權限」→「邀請新使用者」／連結 API 專案）。
3. 若使用「連結 Google Cloud 專案」：連結上述專案後，在 **「權限」** 中將該 **Service Account** 設為可存取 **「查看應用程式資訊與下載量」** 與 **「查看財務資料、訂單和取消」**（或依 Play 畫面提供的權限選項，至少需能讀取購買資料）。
4. 儲存後，該 Service Account 即可代表您的開發者帳戶呼叫 Google Play Developer API。

### 4. 在 Supabase 設定環境變數

將金鑰提供給 Edge Function 使用（**切勿寫進前端程式碼**）：

1. Supabase Dashboard → 您的專案 → **Project Settings** → **Edge Functions**（或 **Secrets**）。
2. 新增以下 Secret（名稱須與程式一致）：
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` = 上述 JSON 的 `client_email`
   - `GOOGLE_PLAY_PRIVATE_KEY` = 上述 JSON 的 `private_key`（可保留 `\n` 換行或整段貼上，依 Deno 實作而定）

若 Supabase 使用 CLI 設定：

```bash
supabase secrets set GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL="xxx@xxx.iam.gserviceaccount.com"
supabase secrets set GOOGLE_PLAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...整段私鑰...
-----END PRIVATE KEY-----"
```

### 5. 後端程式注意事項（verify-google-play-purchase）

- 專案內 `generateGoogleJWT()` 若仍為**模擬／mock**（例如回傳 `mock_jwt_token`），呼叫 Google API 會失敗，驗證會退回「僅基本檢查」。
- **正式環境建議**：在 Edge Function 內用 Deno 可用的 JWT 函式庫（例如 `djwt`）以 `GOOGLE_PLAY_PRIVATE_KEY` 簽署 JWT，再以 `Authorization: Bearer <jwt>` 呼叫  
  `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/products/{productId}/tokens/{purchaseToken}`  
  取得購買狀態並據此發放代幣。
- 完成上述設定後，重新部署 Edge Function：

```bash
npx supabase functions deploy verify-google-play-purchase
```

---

## 四、授權測試人員與正式線的關係

- **授權測試人員**：在 Play Console **「設定」→「授權測試」**（或「測試」相關）中新增的 Google 帳號。
- 這些帳號在**任何軌道**安裝您的 App 時，可選擇「不扣款」的測試購買（依 Play 設定）。
- **一般使用者**（未在授權測試名單內）從 **正式版** 安裝 App 並儲值時，即會**正式扣款**。
- 因此「開啟正式」**不需要**移除授權測試人員；只要正式版已上架，且後端已用 Service Account 做真實驗證即可。

---

## 五、檢查清單（開啟正式前）

| 項目 | 說明 |
|------|------|
| 正式版已建立並推出 | 發布 → 正式 → 已上傳 AAB 且「開始推出正式版」 |
| 應用程式內產品皆為「啟用」 | token_pack_small / medium / large / xlarge |
| Google Play Android Developer API 已啟用 | Google Cloud Console |
| Service Account 已建立並已下載 JSON 金鑰 | 憑證 → 服務帳戶 → 金鑰 |
| Play Console 已授權該 Service Account | 設定 → API 存取權／權限 |
| Supabase 已設定 GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL、GOOGLE_PLAY_PRIVATE_KEY | Edge Function 用 |
| Edge Function 使用真實 JWT 呼叫 Google API | 非 mock，並已重新 deploy |

完成上述步驟後，從 **Play 商店正式版** 安裝的應用程式，其儲值即為**正式線路**（實際扣款）；後端會以 Google Play API 驗證購買並發放代幣。
