export type RuleConfig = {
  minVotesToComment: number;
  dailyVoteLimit: number;
  commentTokenCost: number;
  dataProtectionTokenCost: number;
  /** 發布含梗圖的留言時額外消耗的 Token（0 表示僅受留言規則約束） */
  memePostTokenCost: number;
};

export type AgentRuntimeState = {
  tokenBalance: number;
  votesToday: number;
  votesReceivedForCurrentTopic: number;
  dataProtectionEnabled: boolean;
};

export class RuleEngine {
  constructor(private readonly cfg: RuleConfig) {}

  canVote(state: AgentRuntimeState): { ok: true } | { ok: false; reason: string } {
    if (state.votesToday >= this.cfg.dailyVoteLimit) {
      return { ok: false, reason: "已達每日投票上限" };
    }
    return { ok: true };
  }

  canComment(state: AgentRuntimeState): { ok: true } | { ok: false; reason: string } {
    if (state.votesReceivedForCurrentTopic < this.cfg.minVotesToComment) {
      return { ok: false, reason: "未達留言票數門檻" };
    }
    if (state.tokenBalance < this.cfg.commentTokenCost) {
      return { ok: false, reason: "Token 不足，無法留言" };
    }
    return { ok: true };
  }

  canEnableDataProtection(state: AgentRuntimeState): { ok: true } | { ok: false; reason: string } {
    if (state.dataProtectionEnabled) {
      return { ok: false, reason: "數據保護已開啟" };
    }
    if (state.tokenBalance < this.cfg.dataProtectionTokenCost) {
      return { ok: false, reason: "Token 不足，無法開啟數據保護" };
    }
    return { ok: true };
  }

  canPostMeme(state: AgentRuntimeState): { ok: true } | { ok: false; reason: string } {
    if (this.cfg.memePostTokenCost <= 0) {
      return { ok: true };
    }
    if (state.tokenBalance < this.cfg.memePostTokenCost) {
      return { ok: false, reason: "Token 不足，無法發布梗圖貼文" };
    }
    return { ok: true };
  }

  applyVote(state: AgentRuntimeState): AgentRuntimeState {
    return { ...state, votesToday: state.votesToday + 1 };
  }

  applyComment(state: AgentRuntimeState): AgentRuntimeState {
    return { ...state, tokenBalance: state.tokenBalance - this.cfg.commentTokenCost };
  }

  applyEnableDataProtection(state: AgentRuntimeState): AgentRuntimeState {
    return {
      ...state,
      dataProtectionEnabled: true,
      tokenBalance: state.tokenBalance - this.cfg.dataProtectionTokenCost
    };
  }

  applyPostMeme(state: AgentRuntimeState): AgentRuntimeState {
    if (this.cfg.memePostTokenCost <= 0) return state;
    return { ...state, tokenBalance: state.tokenBalance - this.cfg.memePostTokenCost };
  }
}
