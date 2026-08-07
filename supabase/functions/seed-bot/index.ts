import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const GROK_API_KEY = Deno.env.get("GROK_API_KEY")!
const ADMIN_USER_ID = "bed55f47-d7e9-49b5-988d-500dbcd2a511"

// xAI 可用 model 名稱會變動（已經在別支腳本上踩過雷：grok-4 直接 404），
// 改成執行時實際查 /v1/models，不寫死名稱。跟 voting-patrol / x-promo-bot 同一套做法。
let cachedModelId: string | null | undefined
async function resolveXaiModel(): Promise<string | null> {
  if (cachedModelId !== undefined) return cachedModelId
  try {
    const res = await fetch('https://api.x.ai/v1/models', {
      headers: { Authorization: `Bearer ${GROK_API_KEY}` },
    })
    if (!res.ok) {
      console.error(`❌ 無法取得 xAI 可用模型列表 (status ${res.status})`)
      cachedModelId = null
      return null
    }
    const data = await res.json()
    const ids: string[] = (data?.data || []).map((m: any) => m.id).filter(Boolean)
    const preferred = ids.find((id) => /grok/i.test(id) && !/vision|image/i.test(id)) || ids[0] || null
    console.log(`ℹ️ xAI 可用模型：${ids.join(', ')}；本次採用：${preferred}`)
    cachedModelId = preferred
    return preferred
  } catch (err) {
    console.error('❌ 查詢 xAI 模型列表發生例外：', err instanceof Error ? err.message : String(err))
    cachedModelId = null
    return null
  }
}

type SeedTopicData = {
  title: string
  options: { id: string; text: string }[]
  description?: string
  category?: string
  tags?: string[]
  initial_messages?: string[]
}

// LLM 即使被要求「純 JSON」，也常把回應包在 ```json ... ``` 這種 markdown code fence 裡，
// 直接 JSON.parse 會爆掉。先剝掉 fence 再解析。
function stripJsonCodeFence(raw: string): string {
  const trimmed = raw.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

async function generateSeedTopic(): Promise<SeedTopicData | null> {
  const model = await resolveXaiModel()
  if (!model) {
    console.error('❌ 沒有可用的 xAI model，本次不生成主題')
    return null
  }

  const prompt = `你是 ChaosRegistry 的 SeedBot。產生 1 個輕鬆荒謔的投票主題。
要求（嚴格遵守）：
- title：25 字以內，繁體中文
- options：正好 4 個選項，每個有 "id" 和 "text"
- description：50 字以內
- 返回格式：純 JSON {"title": "...", "options": [{"id":"option-0","text":"..."}, ...], "description": "...", "category": "fun", "tags": ["tag1"], "initial_messages": ["留言1", "留言2"]}`

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 800
      })
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`❌ xAI API 錯誤 (status ${res.status}): ${errText.slice(0, 300)}`)
      return null
    }

    const data = await res.json()
    const raw: string | undefined = data?.choices?.[0]?.message?.content
    if (!raw) {
      console.error('❌ xAI 回應沒有內容')
      return null
    }

    try {
      return JSON.parse(stripJsonCodeFence(raw))
    } catch (parseErr) {
      console.error('❌ 解析 xAI 回應 JSON 失敗：', parseErr instanceof Error ? parseErr.message : String(parseErr), 'raw:', raw.slice(0, 300))
      return null
    }
  } catch (err) {
    console.error('❌ 呼叫 xAI API 發生例外：', err instanceof Error ? err.message : String(err))
    return null
  }
}

// 違禁字檢查（跟前端 validateTopicContent 同一顆 RPC）。這支用 service role 直接呼叫
// add_topic，繞過所有前端把關，AI 生成內容沒有這層檢查就直接對所有使用者公開。
async function checkTopicBannedWords(topicData: SeedTopicData): Promise<{ blocked: boolean; reason?: string }> {
  const combined = [
    topicData.title,
    topicData.description || '',
    ...topicData.options.map((o) => o.text),
  ].join(' ')

  const { data, error } = await supabase.rpc('check_banned_words', {
    p_text: combined,
    p_check_levels: ['A', 'B', 'C', 'D', 'E', 'F'],
  })

  if (error) {
    console.error('❌ 違禁字檢查失敗，保守起見不發布：', error.message)
    return { blocked: true, reason: `違禁字檢查失敗：${error.message}` }
  }

  const hit = Array.isArray(data) && data.length > 0 ? data[0] : null
  if (hit?.found && (hit.action === 'block' || hit.action === 'review')) {
    return { blocked: true, reason: `含${hit.action === 'block' ? '禁止' : '需審核'}字詞：${hit.keyword}` }
  }

  return { blocked: false }
}

serve(async () => {
  try {
    const topicData = await generateSeedTopic()
    if (!topicData) {
      return new Response(JSON.stringify({ error: 'Failed to generate topic content' }), { status: 500 })
    }

    if (!topicData.title || !Array.isArray(topicData.options) || topicData.options.length !== 4) {
      console.error('❌ xAI 回傳格式不符預期：', JSON.stringify(topicData).slice(0, 300))
      return new Response(JSON.stringify({ error: 'Invalid topic format from AI' }), { status: 500 })
    }

    const bannedCheck = await checkTopicBannedWords(topicData)
    if (bannedCheck.blocked) {
      console.error(`❌ 本次生成內容未通過違禁字檢查，不發布：${bannedCheck.reason}`)
      // 200 而非 500：這是內容審核結果，不是系統錯誤，避免被誤判成異常而重試
      return new Response(JSON.stringify({ skipped: true, reason: bannedCheck.reason }), { status: 200 })
    }

    const { data: newTopic, error } = await supabase.rpc('add_topic', {
      p_title: topicData.title,
      p_options: topicData.options,
      p_creator_id: ADMIN_USER_ID,
      p_description: topicData.description || "",
      p_category: topicData.category || "fun",
      p_tags: topicData.tags || ["seed"],
      p_exposure_level: "normal",
      p_duration_days: 7,
      p_status: "active",
      p_approval_status: "approved",
      p_is_hidden: false,
      p_allow_time_extension: true,
      p_allow_option_addition: true,
      p_max_extension_count: 3
    })

    if (error) throw error

    // 初始留言：add_arena_message 這個 RPC 從來不存在（已用 pg_proc 直接查證過），
    // 這段程式碼過去一直在對不存在的函數丟請求，外層又是空的 catch(e){}，
    // 完全靜默失敗，沒有任何 log。改成直接寫 topic_arena_messages，並用真的
    // 機器人角色（bot_profiles）當作者，讓新主題一開始看起來有真人互動，
    // 而不是全部掛在同一個 admin 帳號底下。
    //
    // 注意：角鬥場「一人一主題限一則」的 DB 限制仍然適用（每個角色最多一則）；
    // 但不套用一般的投票參與度門檻（arena_mundane_access_votes）——這是系統
    // 開站用的種子內容，跟真人自然發文是不同情境，此處刻意略過該項門檻。
    const initialMessages = (topicData.initial_messages || []).filter((m) => m && m.trim())
    if (initialMessages.length > 0) {
      const { data: bots, error: botsErr } = await supabase
        .from('bot_profiles')
        .select('user_id, bot_name')
        .limit(initialMessages.length)

      if (botsErr) {
        console.error('❌ 讀取 bot_profiles 失敗，跳過初始留言：', botsErr.message)
      } else {
        const { data: configRows } = await supabase
          .from('system_config')
          .select('key, value')
          .in('key', ['arena_base_data_ttl', 'arena_comment_max_length'])
        const configMap = new Map((configRows || []).map((r: any) => [r.key, r.value]))
        const ttlMinutes = Number(configMap.get('arena_base_data_ttl')) || 480
        const maxLen = Number(configMap.get('arena_comment_max_length')) || 100

        const authorCount = Math.min(initialMessages.length, bots?.length || 0)
        for (let i = 0; i < authorCount; i++) {
          const bot = bots![i]
          const content = initialMessages[i].trim().slice(0, maxLen)

          const { data: bannedRows } = await supabase.rpc('check_banned_words', {
            p_text: content,
            p_check_levels: ['A', 'B', 'C', 'D', 'E', 'F'],
          })
          const hit = Array.isArray(bannedRows) && bannedRows.length > 0 ? bannedRows[0] : null
          if (hit?.found && (hit.action === 'block' || hit.action === 'review')) {
            console.warn(`⚠️ 初始留言（${bot.bot_name}）含違禁字，跳過：${hit.keyword}`)
            continue
          }

          const { error: msgErr } = await supabase.from('topic_arena_messages').insert({
            topic_id: newTopic.id,
            user_id: bot.user_id,
            content,
            ttl_minutes: ttlMinutes,
          })
          if (msgErr) {
            console.error(`❌ 初始留言寫入失敗（${bot.bot_name}）：${msgErr.message}`)
          } else {
            console.log(`✅ 初始留言已發布（${bot.bot_name}）：${content}`)
          }
        }
      }
    }

    console.log(`✅ Seed 成功: ${newTopic.title}`)
    return new Response(JSON.stringify({ success: true, title: newTopic.title, id: newTopic.id }), { status: 200 })
  } catch (e: any) {
    console.error("SeedBot Error:", e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
