# chaos-agent-core

`chaos-agent-core` 是與主站完全隔離的機器人系統。

## 隔離原則

- 程式碼隔離：獨立專案、獨立部署、獨立資料庫。
- 行為隔離：僅透過與 **ChaosRegistry（votechaos）相同之 Supabase 公開介面**（Auth + RPC + RLS）操作，禁止直連自建非公開資料庫。
- 數據隔離：人格、記憶、情緒、稽核日誌只存在本專案與本機 `data/`。

## 機器人與一般用戶規則（政策）

- **與一般用戶相同**：投票、觀點角斗場發言、護盾等，皆走與前台相同之 RPC／RLS；違規時由**後端**回錯（例如票數不足、禁字、主題已結束），與真人一致。
- **唯一額外限制：不得儲值／內購**  
  程式層面：`SupabaseChaosPlatform` **僅允許** RPC 白名單（見 `src/policies/agentPolicy.ts`），目前為 `cast_vote_atomic`、`post_arena_message`；**不實作** App 內購、Edge Function `verify-*-purchase`、`add_tokens` 等儲值路徑。  
  營運上：機器人帳號應以**正常管道**取得代幣（例如活動／後台撥付），**不應**透過本系統模擬儲值。
- **不影響已上線功能**（架構說明）：  
  - `chaos-agent-core` 與 `votechaos-main` **不同 repo**，未合併前**不會改**主站前端／後端程式或部署。  
  - 執行時僅多一個（或多個）**已註冊帳號**以 Supabase 用戶身分呼叫既有 API，與**多一位真人用戶**對後端的影響相同；**不**需要為機器人改資料庫或改 RPC。  
  - 若大量機器人同時操作，理論上與大量真人相同，可能觸發**既有**頻率／限流規則，屬營運與擴充議題，非本機器人程式碼改寫主站邏輯。

## 對接主站（Supabase）

在 `.env` 設定（與主專案 `VITE_SUPABASE_*` 同一專案）：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CHAOS_API_EMAIL` / `CHAOS_API_PASSWORD`（機器人帳號）

啟用後，核心會呼叫：

| 行為 | 主站實作 |
|------|-----------|
| 登入 | `auth.signInWithPassword` |
| 投票 | RPC `cast_vote_atomic` |
| 觀點發言 | RPC `post_arena_message`（**數據鎖／護盾** = `p_buy_shield`） |
| 自我稽核 | 讀取 `topic_arena_messages`（自己的列） |

**未設定** `SUPABASE_URL` + `SUPABASE_ANON_KEY` 時，可改設 `CHAOS_API_BASE_URL` 走舊的 **假 REST** 流程（僅開發用）。

### RunInput 重點（Supabase）

- `topicId`、`voteTargetId`：主題 UUID。
- `voteOptionId`：該主題 `options[].id`（**必填**才能投票）。
- `requestDataProtection`：為 true 時，會在 **同一則** `post_arena_message` 帶 `p_buy_shield`（發言當下購護盾，與前台一致）。
- 梗圖：主站觀點角斗場為純文字，Supabase 模式下會略過圖片上傳。

## 執行控制（後台按鈕驅動）

- **預設停止**：未建立 `RUN_ENABLED` 時，即使程式存在也不會執行計畫。
- **僅後台可觸發**：`agent:plan` / `agent:audit` 需要 `AGENT_TRIGGER_SOURCE=admin-api`，由管理後台 API 注入。
- **緊急剎車**：
  - 環境變數 `AGENT_EMERGENCY_STOP=1`，或
  - 在 `AGENT_DATA_DIR` 根目錄建立 `EMERGENCY_STOP`

當剎車成立時，所有執行請求都會被拒絕。

## 管理後台（Next.js）

目錄：`admin/`

```bash
cd admin
copy .env.example .env.local
npm install
npm run dev
```

瀏覽器開 `http://localhost:3100`：可檢視各 `agentId` 目錄下的 `emotion.json`、稽核日誌尾端，並使用三種按鈕：

- `啟用執行 / 停用執行`（控制 `RUN_ENABLED`）
- `緊急剎車 / 解除剎車`（控制 `EMERGENCY_STOP`）
- `執行主計畫`、`執行自我稽核`（兩個獨立觸發按鈕）

- 請將 **`AGENT_DATA_DIR`** 設成與核心相同的絕對路徑（與 `.env` 中 `AGENT_DATA_DIR` 一致）。
- 可選：`ADMIN_SECRET`，設定後 API 需在標頭帶 `x-admin-secret`（頁面上可填）。

## 階段功能摘要

- **第一～四階段**：規則引擎、RAG、決策日誌、自我稽核、本機情緒（見各 `src/*.ts`）。
- **第五階段**：上述 `admin` 後台（觀察狀態 + 剎車），換魂／派系進階可後續擴充。

## 指令

```bash
npm install
npm run dev          # 只顯示 CLI disabled，不會執行計畫
npm run agent:plan   # 需 AGENT_TRIGGER_SOURCE=admin-api（通常由後台呼叫）
npm run agent:audit  # 需 AGENT_TRIGGER_SOURCE=admin-api（通常由後台呼叫）
npm run typecheck
npm run build
```

需另外啟動 **ChromaDB**（第二階段記憶）：`docker run -p 8000:8000 chromadb/chroma`
