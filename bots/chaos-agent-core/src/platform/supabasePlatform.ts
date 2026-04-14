import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertBotRpcAllowed } from "../policies/agentPolicy.js";
import type { IAuditSource, UnsafeHttpResult } from "./types.js";

/**
 * 與 ChaosRegistry（votechaos）相同：Supabase Auth + RPC + public schema。
 * 觀點角鬥場留言 = `post_arena_message`；主題投票 = `cast_vote_atomic`。
 * 不暴露通用 `rpc`：僅允許白名單 RPC，**禁止儲值／內購**相關呼叫。
 */
export class SupabaseChaosPlatform implements IAuditSource {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, anonKey: string) {
    this.client = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true
      }
    });
  }

  private async invokeAllowedRpc(
    name: "cast_vote_atomic" | "post_arena_message",
    params: Record<string, unknown>
  ): Promise<void> {
    assertBotRpcAllowed(name);
    const { error } = await this.client.rpc(name, params as never);
    if (error) {
      throw new Error(error.message || String(error));
    }
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(`Supabase 登入失敗：${error.message}`);
    }
  }

  async fetchProfileTokens(): Promise<number> {
    const uid = await this.getUserIdRequired();
    const { data, error } = await this.client.from("profiles").select("tokens").eq("id", uid).single();
    if (error || data == null) {
      return 0;
    }
    return Number((data as { tokens: number | null }).tokens ?? 0);
  }

  async getUserIdRequired(): Promise<string> {
    const {
      data: { user },
      error
    } = await this.client.auth.getUser();
    if (error || !user?.id) {
      throw new Error("未登入或無法取得使用者 id");
    }
    return user.id;
  }

  /**
   * 付費投票（與前台 cast_vote_atomic 一致）。
   */
  async castVoteAtomic(
    topicId: string,
    optionId: string,
    voteAmount: number,
    description: string
  ): Promise<void> {
    await this.invokeAllowedRpc("cast_vote_atomic", {
      p_topic_id: topicId,
      p_option_id: optionId,
      p_vote_amount: voteAmount,
      p_description: description
    });
  }

  /**
   * 觀點角鬥場發言。主站「數據鎖定／護盾」對應參數 `p_buy_shield`（發言當下購買，非額外 REST）。
   */
  async postArenaMessage(
    topicId: string,
    content: string,
    buyShield: boolean,
    language: "zh" | "en" | "ja"
  ): Promise<void> {
    await this.invokeAllowedRpc("post_arena_message", {
      p_topic_id: topicId,
      p_content: content,
      p_buy_shield: buyShield,
      p_language: language
    });
  }

  supportsImageMemePost(): boolean {
    return false;
  }

  async getMyCommentsUnsafe(): Promise<UnsafeHttpResult> {
    const uid = await this.getUserIdRequired().catch(() => null);
    if (!uid) {
      return { status: 401 };
    }
    const { data, error } = await this.client
      .from("topic_arena_messages")
      .select("id, content")
      .eq("user_id", uid);
    if (error) {
      return { status: 500, data: { message: error.message } };
    }
    return { status: 200, data };
  }

  async getCommentByIdUnsafe(commentId: string): Promise<UnsafeHttpResult> {
    const { data, error } = await this.client
      .from("topic_arena_messages")
      .select("id, content")
      .eq("id", commentId)
      .maybeSingle();
    if (error) {
      return { status: 500 };
    }
    if (!data) {
      return { status: 404 };
    }
    return { status: 200, data };
  }
}
