import { join } from "path";
import { ChaosApiClient } from "./api/chaosApiClient.js";
import { AiService } from "./aiService.js";
import { config, useSupabaseBackend } from "./config.js";
import {
  recordDataProtectionFailure,
  recordDataProtectionIntent,
  recordMemeBlocked,
  recordMemePublishIntent
} from "./decisionService.js";
import { EmotionStateStore } from "./emotionState.js";
import { InternalLogWriter } from "./internalLog.js";
import { isEmergencyStopActive } from "./killSwitch.js";
import { MemeService } from "./memeService.js";
import { MemoryService } from "./memoryService.js";
import { SupabaseChaosPlatform } from "./platform/supabasePlatform.js";
import { AgentRuntimeState, RuleEngine } from "./ruleEngine.js";
import { SelfAuditService } from "./selfAuditService.js";

export type RunInput = {
  agentId: string;
  conversationPartnerId: string;
  /** 主題 UUID（與主站 topics.id 一致） */
  topicId: string;
  targetTopic: string;
  /** 投票對象主題 id；若與 topicId 相同可重複傳 */
  voteTargetId: string;
  /** Supabase 模式必填：主題選項 id（topics.options[].id） */
  voteOptionId?: string;
  /** 付費投票代幣數量（cast_vote_atomic） */
  voteAmount?: number;
  /** 觀點發言語言（post_arena_message） */
  arenaLanguage?: "zh" | "en" | "ja";
  eventSummary: string;
  styleHint: string;
  dataProtectionApiReason: string;
  dataProtectionInternalDecision: string;
  requestDataProtection: boolean;
  initialTokenBalance: number;
  votesReceivedForCurrentTopic: number;
  memePrompt?: string;
  memeCaption?: string;
};

export async function runAgentScenario(input: RunInput): Promise<void> {
  if (isEmergencyStopActive()) {
    console.error("[Agent] EMERGENCY_STOP：已阻止所有對 ChaosRegistry 的寫入");
    return;
  }

  const memoryService = new MemoryService();
  const aiService = new AiService(memoryService);
  const memeService = new MemeService();

  const useSb = useSupabaseBackend();
  const dataProtectionCost = useSb ? config.ARENA_SHIELD_PRICE : config.DATA_PROTECTION_TOKEN_COST;

  const rules = new RuleEngine({
    minVotesToComment: config.MIN_VOTES_TO_COMMENT,
    dailyVoteLimit: config.DAILY_VOTE_LIMIT,
    commentTokenCost: config.COMMENT_TOKEN_COST,
    dataProtectionTokenCost: dataProtectionCost,
    memePostTokenCost: config.MEME_POST_TOKEN_COST
  });

  let state: AgentRuntimeState = {
    tokenBalance: input.initialTokenBalance,
    votesToday: 0,
    votesReceivedForCurrentTopic: input.votesReceivedForCurrentTopic,
    dataProtectionEnabled: false
  };

  const dataDir = join(config.AGENT_DATA_DIR, input.agentId);
  const internalLog = new InternalLogWriter(join(dataDir, "internal_logs.jsonl"));
  const emotionStore = new EmotionStateStore(join(dataDir, "emotion.json"));
  await emotionStore.load();

  if (useSb) {
    await runSupabasePath({
      input,
      rules,
      state,
      memoryService,
      aiService,
      memeService,
      emotionStore,
      internalLog,
      getState: () => state,
      setState: (s) => {
        state = s;
      }
    });
  } else {
    await runRestPath({
      input,
      rules,
      state,
      memoryService,
      aiService,
      memeService,
      emotionStore,
      internalLog,
      getState: () => state,
      setState: (s) => {
        state = s;
      }
    });
  }

  console.log("[Agent] Final local state:", state);
}

async function runSupabasePath(opts: {
  input: RunInput;
  rules: RuleEngine;
  state: AgentRuntimeState;
  memoryService: MemoryService;
  aiService: AiService;
  memeService: MemeService;
  emotionStore: EmotionStateStore;
  internalLog: InternalLogWriter;
  getState: () => AgentRuntimeState;
  setState: (s: AgentRuntimeState) => void;
}): Promise<void> {
  const {
    input,
    rules,
    memoryService,
    aiService,
    memeService,
    emotionStore,
    internalLog,
    getState,
    setState
  } = opts;

  const sb = new SupabaseChaosPlatform(config.SUPABASE_URL!, config.SUPABASE_ANON_KEY!);
  await sb.signInWithEmail(config.CHAOS_API_EMAIL, config.CHAOS_API_PASSWORD);
  console.log("[Agent] Supabase 登入成功");

  let state = getState();
  state = { ...state, tokenBalance: await sb.fetchProfileTokens() };
  setState(state);

  const selfAudit = new SelfAuditService(
    sb,
    input.agentId,
    join(config.AGENT_DATA_DIR, input.agentId, "comment_snapshot.json"),
    internalLog,
    emotionStore
  );
  await selfAudit.runAuditCycle();
  await emotionStore.save();

  const voteCheck = rules.canVote(state);
  const optionId = input.voteOptionId?.trim();
  if (voteCheck.ok && optionId) {
    const amount = Math.max(1, input.voteAmount ?? 1);
    await sb.castVoteAtomic(input.voteTargetId, optionId, amount, "chaos-agent-core vote");
    state = rules.applyVote(state);
    setState(state);
    state = { ...state, tokenBalance: await sb.fetchProfileTokens() };
    setState(state);
    console.log("[Agent] 已送出 cast_vote_atomic");
  } else if (voteCheck.ok && !optionId) {
    console.warn("[Agent] 已略過投票：請在 RunInput 提供 voteOptionId（主題選項 UUID）");
  } else if (!voteCheck.ok) {
    console.log(`[Agent] Skip vote: ${voteCheck.reason}`);
  }

  const commentCheck = rules.canComment(state);
  if (!commentCheck.ok) {
    console.log(`[Agent] Skip arena post: ${commentCheck.reason}`);
    return;
  }

  const rawText = await aiService.generateComment({
    agentId: input.agentId,
    targetTopic: input.targetTopic,
    conversationPartnerId: input.conversationPartnerId,
    styleHint: input.styleHint,
    eventSummary: input.eventSummary,
    emotionContext: emotionStore.getForAiPrompt()
  });
  const maxLen = Math.min(config.CHAOS_COMMENT_MAX_CHARS, config.ARENA_MAX_COMMENT_CHARS);
  const content = rawText.slice(0, maxLen);

  const buyShield = input.requestDataProtection;
  if (buyShield) {
    await recordDataProtectionIntent(memoryService, input.agentId, input.dataProtectionInternalDecision);
  }

  const protectCheck = rules.canEnableDataProtection(state);
  const willBuyShield = buyShield && protectCheck.ok;

  if (buyShield && !protectCheck.ok) {
    console.error(`[Agent] 數據鎖／護盾未執行（規則閉環）: ${protectCheck.reason}`);
    await recordDataProtectionFailure(memoryService, input.agentId, protectCheck.reason);
  }

  await sb.postArenaMessage(
    input.topicId,
    content,
    willBuyShield,
    input.arenaLanguage ?? "zh"
  );
  console.log("[Agent] 已送出 post_arena_message", { buyShield: willBuyShield });

  setState(
    willBuyShield ? rules.applyEnableDataProtection(state) : rules.applyComment(state)
  );
  state = { ...getState(), tokenBalance: await sb.fetchProfileTokens() };
  setState(state);

  await memoryService.addConversationMemory({
    id: `${input.agentId}-${Date.now()}`,
    agentId: input.agentId,
    counterpartId: input.conversationPartnerId,
    content: `我在主題「${input.targetTopic}」發表觀點：${content}`,
    createdAt: new Date().toISOString(),
    tags: ["comment", "public-action", "arena"]
  });

  if (input.memePrompt?.trim()) {
    console.warn(
      "[Agent] 主站觀點角斗場目前為純文字留言，已略過梗圖流程（Supabase 模式不支援圖片上傳路徑）。"
    );
    await recordMemeBlocked(memoryService, input.agentId, "Supabase 模式未實作圖片上傳至觀點角斗場");
  }
}

async function runRestPath(opts: {
  input: RunInput;
  rules: RuleEngine;
  state: AgentRuntimeState;
  memoryService: MemoryService;
  aiService: AiService;
  memeService: MemeService;
  emotionStore: EmotionStateStore;
  internalLog: InternalLogWriter;
  getState: () => AgentRuntimeState;
  setState: (s: AgentRuntimeState) => void;
}): Promise<void> {
  const {
    input,
    rules,
    memoryService,
    aiService,
    memeService,
    emotionStore,
    internalLog,
    getState,
    setState
  } = opts;

  const api = new ChaosApiClient(config.CHAOS_API_BASE_URL!);
  await api.login(config.CHAOS_API_EMAIL, config.CHAOS_API_PASSWORD);
  console.log("[Agent] Login success (REST mock)");

  const selfAudit = new SelfAuditService(
    api,
    input.agentId,
    join(config.AGENT_DATA_DIR, input.agentId, "comment_snapshot.json"),
    internalLog,
    emotionStore
  );
  await selfAudit.runAuditCycle();
  await emotionStore.save();

  let state = getState();
  const voteCheck = rules.canVote(state);
  if (voteCheck.ok) {
    await api.vote(input.voteTargetId, "up");
    state = rules.applyVote(state);
    setState(state);
    console.log("[Agent] Vote submitted");
  } else {
    console.log(`[Agent] Skip vote: ${voteCheck.reason}`);
  }

  const commentCheck = rules.canComment(state);
  if (commentCheck.ok) {
    const commentContent = await aiService.generateComment({
      agentId: input.agentId,
      targetTopic: input.targetTopic,
      conversationPartnerId: input.conversationPartnerId,
      styleHint: input.styleHint,
      eventSummary: input.eventSummary,
      emotionContext: emotionStore.getForAiPrompt()
    });
    await api.comment(input.topicId, commentContent);
    state = rules.applyComment(state);
    setState(state);
    console.log("[Agent] Comment submitted:", commentContent);
    await memoryService.addConversationMemory({
      id: `${input.agentId}-${Date.now()}`,
      agentId: input.agentId,
      counterpartId: input.conversationPartnerId,
      content: `我在主題「${input.targetTopic}」留言：${commentContent}`,
      createdAt: new Date().toISOString(),
      tags: ["comment", "public-action"]
    });
  } else {
    console.log(`[Agent] Skip comment: ${commentCheck.reason}`);
  }

  if (input.memePrompt?.trim()) {
    const memeCheck = rules.canPostMeme(state);
    if (memeCheck.ok) {
      await recordMemePublishIntent(memoryService, input.agentId, input.memePrompt!.slice(0, 200));
      const png = await memeService.generateMemePng(input.memePrompt!);
      const { url } = await api.uploadImage(new Uint8Array(png), "meme.png", "image/png");
      const caption = (input.memeCaption ?? "（梗圖）").slice(0, config.CHAOS_COMMENT_MAX_CHARS);
      await api.commentWithImage(input.topicId, caption, url);
      state = rules.applyPostMeme(state);
      setState(state);
      console.log("[Agent] Meme published via upload API:", url);
      await memoryService.addConversationMemory({
        id: `${input.agentId}-meme-${Date.now()}`,
        agentId: input.agentId,
        counterpartId: input.conversationPartnerId,
        content: `已發布梗圖留言，圖片 URL：${url}`,
        createdAt: new Date().toISOString(),
        tags: ["meme", "public-action"]
      });
    } else {
      console.error(`[Agent] Meme blocked by rules (不跳過規則): ${memeCheck.reason}`);
      await recordMemeBlocked(memoryService, input.agentId, memeCheck.reason);
    }
  }

  if (input.requestDataProtection) {
    await recordDataProtectionIntent(memoryService, input.agentId, input.dataProtectionInternalDecision);
    state = getState();
    const protectCheck = rules.canEnableDataProtection(state);
    if (protectCheck.ok) {
      await api.enableDataProtection(input.dataProtectionApiReason);
      state = rules.applyEnableDataProtection(state);
      setState(state);
      console.log("[Agent] Data protection enabled via public API");
    } else {
      console.error(`[Agent] Data protection 未執行（規則閉環）: ${protectCheck.reason}`);
      await recordDataProtectionFailure(memoryService, input.agentId, protectCheck.reason);
    }
  }
}
