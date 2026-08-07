# 社群機器人 — 平台申請與憑證設定

Phase 1 的社群機器人（`supabase/functions/social-post-bot`）會用 Grok 生成推廣文案，再透過各平台的真實 API 發文。目前這些憑證一個都還沒申請，這份文件列出每個平台要申請什麼、憑證要放進哪個 Edge Function Secret 名稱。

所有憑證都要設定在：**Supabase Dashboard → Project Settings → Edge Functions → Secrets**（這個專案沒有連線到正式資料庫的直接存取權，所以這一步必須由你自己在 Dashboard 操作，跟現有的 `XAI_API_KEY`、`TWITTER_CLIENT_ID` 是同一個設定位置）。

## 憑證命名總表

每個平台都需要**兩組**憑證：一組給「測試/沙盒帳號」用（`TEST_` 開頭，後台按「產生測試貼文」時用這組)，一組給「正式帳號」用（不加前綴，等 Phase 2 排程自動發文接上後才會用到，現在還不會用）。

**建議先只申請一個平台的 `TEST_` 那組就好，跑通之後再擴展其他平台。**

| 平台 | Secret 名稱（正式） | Secret 名稱（測試沙盒） | 用途 |
|---|---|---|---|
| X (Twitter) | `TWITTER_POST_API_KEY` | `TEST_TWITTER_POST_API_KEY` | App 的 API Key |
| X (Twitter) | `TWITTER_POST_API_SECRET` | `TEST_TWITTER_POST_API_SECRET` | App 的 API Secret |
| X (Twitter) | `TWITTER_POST_ACCESS_TOKEN` | `TEST_TWITTER_POST_ACCESS_TOKEN` | 發文帳號的 Access Token |
| X (Twitter) | `TWITTER_POST_ACCESS_SECRET` | `TEST_TWITTER_POST_ACCESS_SECRET` | 發文帳號的 Access Token Secret |
| Threads | `THREADS_ACCESS_TOKEN` | `TEST_THREADS_ACCESS_TOKEN` | 長效 User Access Token |
| Threads | `THREADS_USER_ID` | `TEST_THREADS_USER_ID` | Threads 帳號的數字 User ID |
| Facebook | `FACEBOOK_PAGE_ACCESS_TOKEN` | `TEST_FACEBOOK_PAGE_ACCESS_TOKEN` | 粉專的 Page Access Token（長效） |
| Facebook | `FACEBOOK_PAGE_ID` | `TEST_FACEBOOK_PAGE_ID` | 粉專的數字 Page ID |

> 注意：`TWITTER_POST_*` 跟現有的 `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` 是兩回事——後者是「使用者用 X 帳號登入本 App」用的 OAuth2 憑證，不能拿來發文；`TWITTER_POST_*` 才是機器人自己拿來發推的憑證。

---

## 1. X (Twitter)

1. 到 [developer.x.com](https://developer.x.com) 建立或選一個 Project + App。
2. App 的 **Permissions** 設成 **Read and Write**（預設通常只有 Read，一定要改）。
3. 進入 **Keys and tokens**：
   - 「API Key and Secret」→ 對應 `TWITTER_POST_API_KEY` / `TWITTER_POST_API_SECRET`
   - 「Access Token and Secret」→ 對應 `TWITTER_POST_ACCESS_TOKEN` / `TWITTER_POST_ACCESS_SECRET`
   - **重要**：Access Token 一定要在把 Permission 改成 Read and Write **之後**重新產生，不然舊 token 沒有寫入權限。
4. 測試帳號：另外申請一個沒在正式使用的 X 帳號（或把它加成同一個 Project 的 collaborator），用它產生自己的一組 Token，四個值都加上 `TEST_` 前綴存進去。

## 2. Threads

1. 到 [developers.facebook.com](https://developers.facebook.com/apps) 建立一個 App，加上 **Threads API** 這個產品。
2. 發文用的帳號必須是已連結 Threads 的 Instagram **專業帳號**（商業或創作者帳號）。
3. 透過 Threads API 的 token 交換流程，取得長效的 User Access Token，並取得對應的 Threads User ID（數字）。
4. 測試帳號：另外申請一個 Instagram 專業帳號並開通 Threads，走同一套流程取得它自己的 token/ID，存成 `TEST_` 前綴。

## 3. Facebook 粉專

1. 用同一個 Meta App（或另開一個）加上 **Pages API** 產品。
2. 建立或使用一個現有粉專，透過 Graph API Explorer（或正式的粉專登入流程）產生有 `pages_manage_posts` 權限的 Page Access Token——**記得要換成長效 token**，不要用預設 1 小時就過期的那種。
3. 記下粉專的數字 Page ID。
4. 測試帳號：另外開一個沒公開、專門拿來測試的粉專，走同一套流程，存成 `TEST_` 前綴。

---

## 設定完憑證之後

1. 把 [supabase/migrations/20260804000000_create_social_bot_posts.sql](../supabase/migrations/20260804000000_create_social_bot_posts.sql) 的內容貼到 Supabase Dashboard 的 SQL Editor 執行，會建立 `social_bot_posts` 發文紀錄表，並帶入 `social_bot_platforms`、`social_bot_prompt` 兩筆預設 `system_config`。
2. 進 `/admin` →「社群機器人」分頁，把還沒設定 `TEST_` 憑證的平台取消勾選，按「產生測試貼文」。
3. 到該平台的測試帳號上確認貼文真的發出去了，並回到同一分頁的「發文紀錄」表格確認狀態是 `posted`（而不是 `failed` 或 `blocked`）。

## 目前還沒做的事

排程、無人值守的「正式發文」（Phase 2）還沒接上——`social-post-bot` 這支 function 雖然支援 `mode: "live"`，但目前沒有任何排程會用這個模式呼叫它。要打開這個開關之前，X 跟 Meta 對「沒有人審核、自動發文的機器人」都有規範（發文頻率、內容重複性、機器人標示要求），到時候要一併設計發文節奏跟文案多樣性,以免帳號被平台判定為 spam。
