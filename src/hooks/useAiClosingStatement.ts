import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BaseLanguage } from "@/contexts/LanguageContext";

interface TopicData {
  id: string;
  title?: string;
  options?: any[];
  total_votes?: number;
  status: string;
  end_at?: string;
}

export interface AiClosingStatement {
  id: string;
  topic_id: string;
  content: string;
  created_at: string;
}

type RawRow = {
  id: string;
  topic_id: string;
  content: string | null;
  content_zh?: string | null;
  content_en?: string | null;
  content_ja?: string | null;
  created_at: string;
};

const parseInvokeErrorMessage = async (err: any): Promise<string> => {
  if (!err) return "Unknown error";
  const direct = err?.message || err?.error_description || err?.details;
  if (typeof direct === "string" && direct.trim() && !/non-2xx/i.test(direct)) {
    return direct;
  }
  try {
    const context = err?.context;
    if (context && typeof context.json === "function") {
      const body = await context.json();
      const fromBody = body?.error || body?.message || body?.details || body?.msg;
      if (typeof fromBody === "string" && fromBody.trim()) return fromBody;
    }
  } catch {
    // ignore parse errors
  }
  if (typeof direct === "string" && direct.trim()) return direct;
  return "Edge function request failed";
};

/** 依 UI 語言選出要顯示的結語內文（三語欄位優先，無則 fallback content） */
function resolveContentByLanguage(row: RawRow, lang: BaseLanguage): string {
  const r = row as Record<string, unknown>;
  const content = typeof r.content === "string" ? r.content : "";
  const zh = (typeof r.content_zh === "string" ? r.content_zh : null) ?? content;
  const en = (typeof r.content_en === "string" ? r.content_en : null) ?? content;
  const ja = (typeof r.content_ja === "string" ? r.content_ja : null) ?? content;
  const byLang: Record<BaseLanguage, string> = { zh, en, ja };
  return byLang[lang]?.trim() || zh || en || ja || content || "";
}

/** 從 DB 讀取結語原始列（三語欄位），不依語言解析，供依 UI 語言即時顯示 */
const fetchClosingRaw = async (topicId: string): Promise<RawRow | null> => {
  const { data, error } = await supabase
    .from("topic_ai_summary")
    .select("id, topic_id, content, content_zh, content_en, content_ja, created_at")
    .eq("topic_id", topicId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return (data as RawRow) ?? null;
};

/** 當 true 表示父層（如 useTopicDetail）正在取得 closing，不要重複請求 */
export const useAiClosingStatement = (
  topic: TopicData | null,
  language: BaseLanguage = "zh",
  initialClosingRaw?: RawRow | null,
  closingInitialPending?: boolean
) => {
  const [statementRaw, setStatementRaw] = useState<RawRow | null>(initialClosingRaw ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasFetched, setHasFetched] = useState(!!(initialClosingRaw && topic?.id && initialClosingRaw.topic_id === topic.id));
  const [error, setError] = useState<string | null>(null);

  const topicMatch = topic?.id && initialClosingRaw && String(initialClosingRaw.topic_id) === String(topic.id);
  const effectiveRaw = topicMatch ? initialClosingRaw : statementRaw;
  const hasFetchedDisplay = hasFetched || !!topicMatch;

  // content 依當前 language 即時計算，切換語言時不需重新請求
  const statement: AiClosingStatement | null = effectiveRaw
    ? {
        id: effectiveRaw.id,
        topic_id: effectiveRaw.topic_id,
        content: resolveContentByLanguage(effectiveRaw, language),
        created_at: effectiveRaw.created_at,
      }
    : null;

  const refetch = useCallback(async () => {
    if (!topic?.id) return;
    const isEnded = topic.status === "ended" || (topic.end_at && new Date(topic.end_at) <= new Date());
    if (!isEnded) return;
    const row = await fetchClosingRaw(topic.id);
    setStatementRaw(row);
  }, [topic?.id, topic?.status, topic?.end_at]);

  useEffect(() => {
    if (!topic) return;
    const isEnded = topic.status === "ended" || (topic.end_at && new Date(topic.end_at) <= new Date());
    if (!isEnded) return;
    if (initialClosingRaw && String(initialClosingRaw.topic_id) === String(topic.id)) {
      setStatementRaw(initialClosingRaw);
      setHasFetched(true);
      return; // 有 initial 即用，不發請求、不設 loading，用戶不會看到讀取彈窗/遮罩
    }
    if (closingInitialPending) return;
    setStatementRaw(null);
    setHasFetched(false);
    let mounted = true;

    const load = async () => {
      try {
        setError(null);
        const row = await fetchClosingRaw(topic.id);
        if (mounted) setStatementRaw(row);
      } catch (e: any) {
        console.error("AI closing statement error:", e);
        if (mounted) setError(e?.message ?? "Failed to load");
      } finally {
        if (mounted) {
          setIsLoading(false);
          setHasFetched(true);
        }
      }
    };

    load();
    return () => { mounted = false; };
  }, [topic?.id, topic?.status, initialClosingRaw?.topic_id, closingInitialPending]);

  /** 手動觸發產生混亂結語（已結束主題且尚無結語時可用，不需等排程）。已產生結語則不再呼叫 API。 */
  const triggerGenerate = useCallback(async (): Promise<{ success: boolean; generated?: boolean; error?: string }> => {
    if (!topic?.id) return { success: false, generated: false, error: "No topic" };
    const isEnded = topic.status === "ended" || (topic.end_at && new Date(topic.end_at) <= new Date());
    if (!isEnded) return { success: false, generated: false, error: "Topic not ended" };
    if (statementRaw) return { success: true, generated: false };
    try {
      setIsGenerating(true);
      setError(null);
      const { data, error: invokeErr } = await supabase.functions.invoke("generate-ai-closing", {
        body: { topic_id: topic.id },
        method: "POST",
      });
      if (invokeErr) {
        const msg = await parseInvokeErrorMessage(invokeErr);
        setError(msg);
        return { success: false, generated: false, error: msg };
      }
      if (data?.error) {
        setError(data.error);
        return { success: false, generated: false, error: data.error };
      }
      if (data?.success && data?.data) {
        const raw = data.data as RawRow;
        setStatementRaw({ ...raw, topic_id: raw.topic_id ?? topic.id });
        return { success: true, generated: true };
      }
      const refreshed = await fetchClosingRaw(topic.id);
      setStatementRaw(refreshed);
      return { success: !!refreshed, generated: !!refreshed };
    } catch (e: any) {
      const msg = e?.message ?? "Failed to generate";
      setError(msg);
      return { success: false, generated: false, error: msg };
    } finally {
      setIsGenerating(false);
    }
  }, [topic?.id, topic?.status, topic?.end_at, statementRaw]);

  return { statement, isLoading, isGenerating, hasFetched: hasFetchedDisplay, error, triggerGenerate, refetch };
};
