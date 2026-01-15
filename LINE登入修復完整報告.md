# LINE 登入問題與修復完整報告

## 📅 日期：2026-01-15
## 🛠️ 狀態：✅ 已修復

---

## 🔍 問題總結

LINE 第三方登入功能在 App 端無法正常完成，經過診斷發現主要涉及兩個層面的問題：**重定向路徑錯誤** 與 **程式碼語法錯誤導致的 CORS 失敗**。

---

## 1. 根本原因一：重定向路徑導致 Context 丟失

### ❌ 問題描述
當使用者在 LINE 完成授權後，Edge Function 原本的設計是將使用者重定向到網頁版的前端 URL：
`https://chaos-registry.vercel.app/auth/callback`

### 💥 造成的影響
在 Native App (Android/iOS) 環境中，這個行為會導致：
1.  WebView 或瀏覽器載入了網頁版的登入頁面，而不是跳轉回 App 原生介面。
2.  App 的 `Deep Link` 攔截機制（`votechaos://`）沒有被觸發。
3.  App 本身失去了登入流程的控制權（Context Loss），導致無法獲取 Session Token，使用者看起來像是「登入後卡在網頁」或「沒反應」。

### ✅ 修復方案
修改 `line-auth` 與 `line-auth-callback` Edge Functions，將預設的重定向路徑更改為 App 專用的 **Deep Link**：
`votechaos://auth/callback`

這樣做確保了：
*   OS 能正確識別並喚醒 App。
*   App 能正確接收 URL 中的 `code` 與 `state` 參數，繼續完成登入驗證。

---

## 2. 根本原因二：語法錯誤導致 CORS 預檢失敗

### ❌ 問題描述
在嘗試修復上述重定向問題時，程式碼中引入了一個 `SyntaxError`。具體來說，在 `supabase/functions/line-auth/index.ts` 中，`supabaseAdmin` 變數被 **重複宣告 (Redeclared)** 了兩次。

### 💥 造成的影響
1.  **Runtime Crash**: 當 Edge Function 啟動或收到請求時，JavaScript 引擎拋出錯誤並立即中止執行。
2.  **CORS Error**: 瀏覽器在發送正式請求前，會先發送一個 `OPTIONS` 預檢請求 (Preflight Request)。
    *   預期：伺服器回傳 `200 OK` 或 `204 No Content` 以及正確的 CORS Headers。
    *   實際：因為程式崩潰，伺服器回傳了 `500 Internal Server Error` (或者連線直接中斷)。
3.  **誤判**: 瀏覽器看到 `OPTIONS` 請求失敗，便判定為 **CORS Policy 錯誤** (`Response to preflight request doesn't pass access control check`)，這讓問題看起來像是權限設定錯誤，但其實是程式碼本身的語法錯誤導致伺服器無法回應。

### ✅ 修復方案
移除重複的變數宣告，確保程式碼語法正確。重新部署後，Edge Function 能正常處理 `OPTIONS` 請求並回傳正確的 CORS Headers。

---

## 🔄 修復後流程圖

1.  **User** 點擊 LINE 登入。
2.  **App** 呼叫 `line-auth` Edge Function (POST)。
3.  **Edge Function** 回傳 LINE 授權網址。
4.  **App** 開啟授權網址 (WebView/Browser)。
5.  **User** 在 LINE 同意授權。
6.  **LINE** 重定向回 `.../line-auth-callback` (Edge Function)。
7.  **Edge Function** 驗證後，重定向至 `votechaos://auth/callback...` (Deep Link) <--- **(關鍵修正點)**。
8.  **App** 攔截 Deep Link，提取參數，完成 Session 建立。
9.  **User** 登入成功。

---

## 📝 建議後續行動

*   **保留 Deep Link 機制**：只要是 App 端的第三方登入，務必確保回調優先使用 Deep Link，避免網頁與 App 混淆。
*   **部署前檢查**：建議在部署 Edge Function 前，使用 `deno check` 或 TypeScript 編譯器進行一次靜態檢查，以避免語法錯誤上線。
