# GPT → Grok（xAI）遷移說明

**更新日期**：2026-05-21

## 盤點結果

| 區塊 | 檔案 | 原模型 | 現狀 |
|------|------|--------|------|
| 主 App 前端 | `src/` | — | 無直接呼叫 LLM |
| Edge Function | `generate-ai-closing` | `gpt-4o-mini` | ✅ 已改 Grok |
| Edge Function | `ai-chaos-rewrite` | `gpt-4o-mini` | ✅ 已改 Grok |
| Edge Function | `ai-user-classification` | `gpt-4o-mini` | ✅ 已改 Grok |
| Bot | `chaos-agent-core` 留言生成 | `gpt-4o` | ✅ 已改 `grok-4.3` |
| Bot | `chaos-agent-core` 梗圖 | `dall-e-3` | ✅ 已改 `grok-imagine-image-quality` |
| Bot | `chaos-agent-core` 記憶向量 | `text-embedding-3-small` | ⚠️ 仍用 **Gemini embed**（xAI 無 embeddings API） |

共用模組：`supabase/functions/_shared/xai.ts`

## Supabase 部署前必做

1. [xAI Console](https://console.x.ai) 建立 API Key。
2. Supabase Dashboard → **Project Settings → Edge Functions → Secrets**：
   - 新增 **`XAI_API_KEY`** = 你的 xAI key
   - （可選）刪除或保留舊 `OPENAI_API_KEY`；程式會優先讀 `XAI_API_KEY`，沒有時才 fallback `OPENAI_API_KEY`
3. 重新部署三個 Function：

```bash
npx supabase functions deploy generate-ai-closing
npx supabase functions deploy ai-chaos-rewrite
npx supabase functions deploy ai-user-classification
```

## chaos-agent-core 環境變數

```env
XAI_API_KEY=...
GOOGLE_API_KEY=...   # 私有記憶 RAG 向量（必填，即使 AI_PROVIDER=grok）
AI_PROVIDER=grok
XAI_CHAT_MODEL=grok-4.3
XAI_IMAGE_MODEL=grok-imagine-image-quality
```

`openai` npm 套件仍保留，作為 **xAI 相容 SDK**（`baseURL: https://api.x.ai/v1`）。

## 模型對照

| 用途 | 舊 | 新（預設） |
|------|-----|------------|
| 結語 / 改寫 / 用戶側寫 | `gpt-4o-mini` | `grok-4-1-fast-non-reasoning` |
| Bot 留言 | `gpt-4o` | `grok-4.3` |
| 梗圖 | `dall-e-3` | `grok-imagine-image-quality` |
| 記憶向量 | `text-embedding-3-small` | `text-embedding-004`（Gemini） |

可透過環境變數 `XAI_FAST_MODEL`（Edge）或 `XAI_CHAT_MODEL`（Bot）覆寫。
