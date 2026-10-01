import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

/**
 * 已用 information_schema 對照過正式環境確認：
 * - bot_profiles.user_id 是 uuid NOT NULL，5 隻機器人全部都對應到真實 profiles.id
 * - topic_arena_messages.user_id 是 NOT NULL + FK REFERENCES profiles(id)
 * - 用 SERVICE_ROLE_KEY 呼叫會整個繞過 RLS
 * 下面仍保留「沒有 user_id 就跳過留言」的防呆分支，避免未來新增機器人時忘記帶 user_id
 * 導致整支腳本因為一筆資料異常而中斷。
 */

type BotProfile = {
  bot_name: string;
  user_id?: string | null;
  daily_budget?: number;
  // 正式環境目前實際出現過的 style：heavy/medium/light/extreme/cute（不保證只有這幾種）
  style?: 'heavy' | 'medium' | 'light' | 'extreme' | 'cute' | string;
};

/** votes 表的 CHECK 限制：amount > 0 AND amount <= 100（見 20251008074549 migration
 *  的 check_vote_amount_positive）。所有投票金額都必須守這個上限，不然 votes 表
 *  upsert 會失敗（曾實際發生：extreme 固定 150 分導致該機器人永遠無法通過角鬥場
 *  參與度門檻，因為它的票從來沒被記進 votes 表）。 */
const VOTE_AMOUNT_MAX = 100;

/** style → 投票金額範圍（隨機抽取，不再是固定值，避免每次都是同樣的數字或 5 的倍數）。
 *  未列出的 style 會退回用 daily_budget 估算一個範圍。 */
const STYLE_VOTE_RANGE: Record<string, [number, number]> = {
  extreme: [70, 100],
  heavy: [50, 90],
  medium: [15, 40],
  cute: [8, 20],
  light: [5, 15],
};

function randomIntInRange(min: number, max: number): number {
  const lo = Math.max(1, Math.min(min, max));
  const hi = Math.min(VOTE_AMOUNT_MAX, Math.max(min, max));
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function voteAmountForBot(bot: BotProfile): number {
  const range = bot.style ? STYLE_VOTE_RANGE[bot.style] : undefined;
  if (range) return randomIntInRange(range[0], range[1]);
  const base = Math.max(5, Math.round((bot.daily_budget || 100) / 10));
  return randomIntInRange(Math.round(base * 0.7), Math.round(base * 1.3));
}

type TopicOption = { id?: string; text?: string; votes?: number };

type Topic = {
  id: string;
  title: string;
  total_votes?: number;
  options: TopicOption[] | null;
  end_at: string;
};

type ArenaConfig = {
  accessVotes: number;   // arena_mundane_access_votes：需累積投票參與度才能留言
  baseTtlMinutes: number; // arena_base_data_ttl：留言初始存在週期
  maxLen: number;         // arena_comment_max_length：留言字數上限
};

async function loadArenaConfig(): Promise<ArenaConfig> {
  const { data, error } = await supabase
    .from('system_config')
    .select('key, value')
    .in('key', ['arena_mundane_access_votes', 'arena_base_data_ttl', 'arena_comment_max_length']);

  if (error) {
    console.error('❌ 讀取 arena 設定失敗，改用預設值：', error.message);
  }

  const map = new Map((data || []).map((row: any) => [row.key, row.value]));
  const readInt = (key: string, fallback: number) => {
    const raw = map.get(key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    accessVotes: readInt('arena_mundane_access_votes', 5),
    baseTtlMinutes: readInt('arena_base_data_ttl', 180),
    maxLen: readInt('arena_comment_max_length', 100),
  };
}

// ---------------------------------------------------------------------------
// 留言生成：接 xAI（Grok）API，環境變數 XAI_API_KEY；失敗則退回隨機模板，
// 確保單次 API 異常不會讓整趟巡邏中斷。
// ---------------------------------------------------------------------------
const FALLBACK_TEMPLATES = [
  "這個太有感覺了！",
  "完全同意哈哈",
  "投一票支持",
  "這題我每天都想投",
  "荒謬但好玩",
  "強烈認同",
  "台灣人的日常",
  "笑死投了",
  "這就是人生",
  "有趣，投！",
];

function randomTemplate(): string {
  return FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)];
}

// xAI 的可用 model 名稱會隨帳號/時間變動（已經猜錯過一次：grok-2-latest 回
// "Model not found"），改成執行時實際問 /v1/models 拿當下真的能用的清單，
// 而不是把猜測的名稱寫死。同一次函式啟動內快取結果，不用每則留言都重查。
let cachedModelId: string | null | undefined;

async function resolveXaiModel(apiKey: string): Promise<string | null> {
  if (cachedModelId !== undefined) return cachedModelId;
  try {
    const res = await fetch('https://api.x.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`❌ 無法取得 xAI 可用模型列表 (status ${res.status}): ${errText.slice(0, 300)}`);
      cachedModelId = null;
      return null;
    }
    const data = await res.json();
    const ids: string[] = (data?.data || []).map((m: any) => m.id).filter(Boolean);
    if (ids.length === 0) {
      console.error('❌ xAI 模型清單是空的');
      cachedModelId = null;
      return null;
    }
    // 優先挑名稱含 grok 且不是 vision/image 專用的模型，找不到就用清單第一個
    const preferred = ids.find((id) => /grok/i.test(id) && !/vision|image/i.test(id)) || ids[0];
    console.log(`ℹ️ xAI 可用模型：${ids.join(', ')}；本次採用：${preferred}`);
    cachedModelId = preferred;
    return preferred;
  } catch (err) {
    console.error('❌ 查詢 xAI 模型列表發生例外：', err instanceof Error ? err.message : String(err));
    cachedModelId = null;
    return null;
  }
}

async function generateComment(botName: string, topicTitle: string): Promise<string> {
  const apiKey = Deno.env.get('XAI_API_KEY');
  if (!apiKey) {
    console.warn('⚠️ 未設定 XAI_API_KEY，改用隨機模板留言');
    return randomTemplate();
  }

  const model = await resolveXaiModel(apiKey);
  if (!model) {
    return randomTemplate();
  }

  const prompt = `你現在扮演一個叫做「${botName}」的網路留言者。針對投票主題「${topicTitle}」，用你的角色語氣寫一句自然、輕鬆、可能帶點荒謬或支持性的短留言。
規則：
- 限制在 15 個繁體中文字以內
- 不要加引號、不要加任何說明或前綴，只回傳留言本身
- 語氣要像真人隨手留言，不要太制式`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`❌ xAI API 錯誤 (status ${response.status}): ${errText.slice(0, 300)}`);
      return randomTemplate();
    }

    const data = await response.json();
    const raw: string | undefined = data?.choices?.[0]?.message?.content;
    if (!raw || !raw.trim()) {
      console.warn('⚠️ xAI 回應沒有內容，改用隨機模板');
      return randomTemplate();
    }

    // 去除模型可能夾帶的引號/前後空白，並做長度保護
    const cleaned = raw.trim().replace(/^["「『]+|["」』]+$/g, '').slice(0, 30);
    return cleaned || randomTemplate();
  } catch (err) {
    console.error('❌ 呼叫 xAI API 發生例外：', err instanceof Error ? err.message : String(err));
    return randomTemplate();
  }
}

// ---------------------------------------------------------------------------
// 極簡違禁字遮罩（等同前端 src/lib/bannedWords.ts 的 maskMatchedKeyword 規則：
// 命中長度 > 1 保留第一字＋***，命中長度 = 1 整段改 ***）
// ---------------------------------------------------------------------------
function maskKeyword(text: string, keyword: string): string {
  if (!text || !keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  return text.replace(regex, (match) => {
    const chars = Array.from(match);
    return chars.length <= 1 ? '***' : `${chars[0]}***`;
  });
}

// ---------------------------------------------------------------------------
// 幫機器人在觀點角鬥場留言，完整比照 post_arena_message RPC 的規則：
// 一人一主題限一則、需累積投票參與度、字數上限、違禁字檢查。
// 用 service role 直接寫表（繞過 RPC 的 auth.uid() 驗證，機器人沒有登入 session）。
// ---------------------------------------------------------------------------
async function postBotArenaComment(
  bot: BotProfile,
  topic: Topic,
  config: ArenaConfig,
  rawComment: string
): Promise<{ posted: boolean; reason?: string }> {
  if (!bot.user_id) {
    return { posted: false, reason: 'bot_profiles 缺少 user_id，無法對應 profiles，跳過留言' };
  }

  // 一人一主題限一則
  const { data: existing, error: existingErr } = await supabase
    .from('topic_arena_messages')
    .select('id')
    .eq('topic_id', topic.id)
    .eq('user_id', bot.user_id)
    .maybeSingle();
  if (existingErr) {
    return { posted: false, reason: `檢查是否已留言時出錯：${existingErr.message}` };
  }
  if (existing) {
    return { posted: false, reason: '此機器人已在該主題留過言（角鬥場規則：一人一則）' };
  }

  // 投票參與度門檻：與 post_arena_message RPC 相同的算法（付費票加總 + 免費票次數）
  const [{ data: voteRows, error: voteErr }, { count: freeVoteCount, error: freeVoteErr }] = await Promise.all([
    supabase.from('votes').select('amount').eq('user_id', bot.user_id).eq('topic_id', topic.id),
    supabase.from('free_votes').select('id', { count: 'exact', head: true }).eq('user_id', bot.user_id).eq('topic_id', topic.id),
  ]);
  if (voteErr || freeVoteErr) {
    return { posted: false, reason: `查詢投票參與度時出錯：${(voteErr || freeVoteErr)?.message}` };
  }
  const participation = (voteRows || []).reduce((sum, v: any) => sum + (Number(v.amount) || 0), 0) + (freeVoteCount || 0);
  if (participation < config.accessVotes) {
    return { posted: false, reason: `投票參與度不足（${participation}/${config.accessVotes}），角鬥場規則要求先達門檻才能留言` };
  }

  const trimmed = rawComment.trim().slice(0, config.maxLen);
  if (!trimmed) {
    return { posted: false, reason: '留言內容為空' };
  }

  // 違禁字檢查（跟前端同一個 RPC）
  const { data: bannedRows, error: bannedErr } = await supabase.rpc('check_banned_words', {
    p_text: trimmed,
    p_check_levels: ['A', 'B', 'C', 'D', 'E', 'F'],
  });
  if (bannedErr) {
    console.warn(`⚠️ 違禁字檢查失敗（${bot.bot_name}），保守起見跳過這則留言：`, bannedErr.message);
    return { posted: false, reason: `違禁字檢查失敗：${bannedErr.message}` };
  }

  let finalContent = trimmed;
  const hit = Array.isArray(bannedRows) && bannedRows.length > 0 ? bannedRows[0] : null;
  if (hit?.found) {
    if (hit.action === 'block') {
      return { posted: false, reason: `留言含違禁字（${hit.keyword}），已擋下` };
    }
    if (hit.action === 'mask') {
      finalContent = maskKeyword(trimmed, hit.keyword);
    }
    // action === 'review'：機器人留言沒有人工審核入口，這裡選擇直接擋下，不自動送審
    if (hit.action === 'review') {
      return { posted: false, reason: `留言含需審核字詞（${hit.keyword}），機器人留言不自動送審` };
    }
  }

  const { error: insertErr } = await supabase.from('topic_arena_messages').insert({
    topic_id: topic.id,
    user_id: bot.user_id,
    content: finalContent,
    ttl_minutes: config.baseTtlMinutes,
  });

  if (insertErr) {
    // 23505 = unique_violation：可能是同一輪巡邏中另一個併發呼叫已搶先插入，視為已完成，不算錯誤
    if ((insertErr as any).code === '23505') {
      return { posted: false, reason: '併發衝突：已有其他請求搶先留言（視為已完成）' };
    }
    return { posted: false, reason: `寫入角鬥場留言失敗：${insertErr.message}` };
  }

  return { posted: true };
}

// ---------------------------------------------------------------------------
// 幫機器人投票：呼叫 increment_option_votes RPC（DB 端原子操作，不會有多機器人
// 互相蓋掉票數的競態問題），並把票數 upsert 進 votes 表——這樣機器人的參與度
// 才會被角鬥場的門檻檢查算進去，也讓 topics.total_votes 以外的帳目一致。
// ---------------------------------------------------------------------------
async function castBotVote(
  bot: BotProfile,
  topic: Topic,
  optionIndex: number,
  amount: number
): Promise<{ ok: boolean; reason?: string }> {
  const options = topic.options || [];
  const option = options[optionIndex];
  const optionId = option?.id || `option-${optionIndex}`;

  const { error: rpcErr } = await supabase.rpc('increment_option_votes', {
    p_topic_id: topic.id,
    p_option_id: optionId,
    p_vote_amount: amount,
  });
  if (rpcErr) {
    return { ok: false, reason: `increment_option_votes 失敗：${rpcErr.message}` };
  }

  if (bot.user_id) {
    const { data: existingVote, error: existingErr } = await supabase
      .from('votes')
      .select('amount')
      .eq('user_id', bot.user_id)
      .eq('topic_id', topic.id)
      .maybeSingle();
    if (existingErr) {
      console.warn(`⚠️ ${bot.bot_name} 讀取既有投票紀錄失敗（不影響票數本身，只影響參與度累計）：`, existingErr.message);
    } else {
      const nextAmount = (existingVote?.amount || 0) + amount;
      const { error: upsertErr } = await supabase
        .from('votes')
        .upsert(
          { topic_id: topic.id, user_id: bot.user_id, option: optionId, amount: nextAmount },
          { onConflict: 'user_id,topic_id' }
        );
      if (upsertErr) {
        console.warn(`⚠️ ${bot.bot_name} 寫入 votes 紀錄失敗（不影響票數本身，只影響參與度累計）：`, upsertErr.message);
      }
    }
  }

  return { ok: true };
}

Deno.serve(async () => {
  try {
    const [{ data: bots, error: botsErr }, { data: topics, error: topicsErr }, config] = await Promise.all([
      supabase.from('bot_profiles').select('*'),
      supabase
        .from('topics')
        .select('id, title, total_votes, options, end_at')
        .eq('status', 'active')
        .gte('end_at', new Date().toISOString())
        // seed-bot 不再自己貼初始留言，新主題的機器人留言全靠這裡，所以必須優先挑最新的主題
        .order('created_at', { ascending: false })
        .limit(8),
      loadArenaConfig(),
    ]);

    if (botsErr) {
      console.error('❌ 讀取 bot_profiles 失敗：', botsErr.message);
      return new Response('Error loading bots', { status: 500 });
    }
    if (topicsErr) {
      console.error('❌ 讀取 topics 失敗：', topicsErr.message);
      return new Response('Error loading topics', { status: 500 });
    }

    console.log(`找到 ${bots?.length || 0} 隻機器人，${topics?.length || 0} 個未過期 active 主題`);

    for (const bot of (bots || []) as BotProfile[]) {
      let spent = 0;
      let voteCount = 0;
      let commentCount = 0;

      const budget = bot.daily_budget || 100;

      for (const topic of (topics || []) as Topic[]) {
        if (spent >= budget) break;
        if (Math.random() > 0.55) continue;
        if (!Array.isArray(topic.options) || topic.options.length === 0) continue;

        const amount = voteAmountForBot(bot);
        // 隨機金額可能超出剩餘預算：換下一個主題重抽，不直接 break，避免只因為
        // 一次抽到偏大的金額就提早收工、預算沒花完
        if (spent + amount > budget) continue;
        const optionIndex = Math.floor(Math.random() * topic.options.length);
        const comment = await generateComment(bot.bot_name, topic.title);

        const voteResult = await castBotVote(bot, topic, optionIndex, amount);
        if (!voteResult.ok) {
          console.error(`❌ ${bot.bot_name} 投票失敗（「${topic.title}」）：${voteResult.reason}`);
          continue;
        }
        spent += amount;
        voteCount++;

        const { error: logErr } = await supabase.from('bot_actions').insert({
          bot_name: bot.bot_name,
          action_type: 'vote',
          topic_id: topic.id,
          amount,
          comment_text: comment,
        });
        if (logErr) {
          console.error(`❌ ${bot.bot_name} 寫入 bot_actions 紀錄失敗（不影響投票本身）：${logErr.message}`);
        }

        const arenaResult = await postBotArenaComment(bot, topic, config, comment);
        if (arenaResult.posted) {
          commentCount++;
          console.log(`✅ ${bot.bot_name} 投了「${topic.title}」 +${amount} 票，並在角鬥場留言：${comment}`);
        } else {
          console.log(`ℹ️ ${bot.bot_name} 投了「${topic.title}」 +${amount} 票，角鬥場留言未發佈（${arenaResult.reason}）`);
        }
      }

      console.log(`📊 ${bot.bot_name} 總投票 ${voteCount} 次、角鬥場留言 ${commentCount} 則，消耗 ${spent}/${bot.daily_budget ?? 'N/A'}`);
    }

    return new Response('✅ Voting patrol completed', { status: 200 });
  } catch (error) {
    console.error('重大錯誤:', error instanceof Error ? error.message : error);
    return new Response('Error', { status: 500 });
  }
});