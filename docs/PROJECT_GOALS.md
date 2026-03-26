# 專案全域目標（PROJECT GOALS）

本文件用於統一專案在安全、穩定、可維運與可回滾上的目標與交付標準，並持續追蹤重要變更的風險與下一步。

## 長期目標

- **安全優先**：最小權限、避免秘密外洩、所有輸入視為不可信、可稽核；資料一致性由後端/資料庫保證。
- **可審計**：關鍵動作（例如：派發代幣、任務完成、內購驗證）需具備可追溯的交易紀錄與日誌。
- **可回滾**：所有資料庫變更必須以 migration/SQL patch 形式提供，並可在風險可控下回退。
- **一致性**：前端顯示與後端計算（任務獎勵、限制、進度）需以同一權威來源（system_config / DB）為準。

## 近期工作流（摘要）

- **iOS 內購（IAP）**：採用 Apple 建議的 **App Store Server API** 以 `transactionId` 驗證（對應 `cordova-plugin-purchase` 在 iOS receipt 取得不穩定的現況）。
- **後端驗證（Supabase Edge Function）**：集中在 `verify-app-store-purchase`，需正確設定 App Store Server API Secrets（`APP_STORE_KEY_ID` / `APP_STORE_ISSUER_ID` / `APP_STORE_PRIVATE_KEY` / `APP_STORE_BUNDLE_ID`）。

## 變更紀錄（可直接追加）

### 2026-03-12：修正 App Store Server API JWT claim 組裝（401 Unauthenticated）

- **完成項目**：修正 `verify-app-store-purchase` 生成 JWT 時的 payload，確保包含 Apple 規格所需的 `bid`（Bundle ID），避免呼叫 App Store Server API 回 `401 - Unauthenticated`。
- **風險**
  - 若 Supabase 上仍部署舊版本 function，錯誤會持續（需要明確確認部署版本已更新）。
  - 若 App Store Connect API Key 權限不足或 Key/Issuer/Private Key 不匹配，仍可能回 401。
- **下一步**
  - 重新部署 `verify-app-store-purchase`。
  - 以 Supabase Logs 驗證：401 是否消失，並確認能解析 `signedTransactionInfo`。
  - 完成 iOS 端一次成功購買 → 後端發放代幣 → 記錄交易的端到端驗證。

### 2026-03-26：任務系統—暱稱任務改為「標記可領取 → 任務頁點擊才發獎」

- **完成內容**
  - 改暱稱成功後不直接發獎，僅標記 `nickname_editor` 任務 progress，讓任務頁出現「領取獎勵」按鈕。
  - 透過資料庫層判重，確保任務獎勵不可重複領取。
  - 個人頁移除「修改暱稱操作提示」文案顯示，降低干擾。
- **風險**
  - 若 Supabase 尚未套用最新 migrations，任務標記/領取 RPC 可能不可用（需先套用 migrations）。
- **下一步**
  - 在 Supabase 套用 migrations 後，於 iOS/Android 端實測：
    - 改暱稱不發獎 → 任務頁點擊領取才發獎 → 重複點擊不重複發獎。

