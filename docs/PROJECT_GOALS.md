# PROJECT GOALS（全域專案目標）

> 本文件用於持續追蹤本專案的核心目標、非功能性需求（安全/穩定/可回滾）、以及每次重要變更的風險與下一步。

## 核心目標

- **安全第一**：最小權限、避免秘密外洩、所有輸入視為不可信、可稽核。
- **穩定與可恢復**：任何變更都需可回滾、可驗證、可觀測（Logs/指標/告警）。
- **可維護性**：文件齊全、流程可重複、避免一次性不可追蹤修補。

## 近期工作流（摘要）

- **iOS 內購（IAP）**：採用 Apple 建議的 **App Store Server API** 以 `transactionId` 驗證（對應 `cordova-plugin-purchase` 在 iOS receipt 取得不穩定的現況）。
- **後端驗證（Supabase Edge Function）**：集中在 `verify-app-store-purchase`，需正確設定 App Store Server API Secrets（`APP_STORE_KEY_ID` / `APP_STORE_ISSUER_ID` / `APP_STORE_PRIVATE_KEY` / `APP_STORE_BUNDLE_ID`）。

## 變更紀錄（可直接追加）

### 2026-03-12：修正 App Store Server API JWT claim 組裝（401 Unauthenticated）

- **完成項目**：修正 `verify-app-store-purchase` 生成 JWT 時的 payload，確保包含 Apple 規格所需的 `bid`（Bundle ID），避免呼叫 App Store Server API 回 `401 - Unauthenticated`。
- **風險**：
  - 若 Supabase 上仍部署舊版本 function，錯誤會持續（需要明確確認部署版本已更新）。
  - 若 App Store Connect API Key 權限不足或 Key/Issuer/Private Key 不匹配，仍可能回 401。
- **下一步**：
  - 重新部署 `verify-app-store-purchase`。
  - 以 Supabase Logs 驗證：401 是否消失，並確認能解析 `signedTransactionInfo`。
  - 完成 iOS 端一次成功購買 → 後端發放代幣 → 記錄交易的端到端驗證。

