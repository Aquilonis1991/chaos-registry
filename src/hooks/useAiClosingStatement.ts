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

/** 依 UI 語言選出要顯示的結語內文（三語欄位優先，無則 fallback content） */
function resolveContentByLanguage(row: RawRow, lang: BaseLanguage): string {
  const zh = row.content_zh ?? row.content;
  const en = row.content_en ?? row.content;
  const ja = row.content_ja ?? row.content;
  const byLang = { zh, en, ja };
  return byLang[lang] || zh || en || ja || "";
}

/** 從 DB 讀取結語（含三語欄位），並依語言回傳單一 content */
const fetchClosing = async (topicId: string, language: BaseLanguage) => {
  const { data, error } = await supabase
    .from("topic_ai_summary")
    .select("id, topic_id, content, content_zh, content_en, content_ja, created_at")
    .eq("topic_id", topicId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  const row = data as RawRow;
  return {
    id: row.id,
    topic_id: row.topic_id,
    content: resolveContentByLanguage(row, language),
    created_at: row.created_at,
  } as AiClosingStatement;
};

export const useAiClosingStatement = (topic: TopicData | null, language: BaseLanguage = "zh") => {
  const [statement, setStatement] = useState<AiClosingStatement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!topic?.id) return;
    const isEnded = topic.status === "ended" || (topic.end_at && new Date(topic.end_at) <= new Date());
    if (!isEnded) return;
    const data = await fetchClosing(topic.id, language);
    setStatement(data);
  }, [topic?.id, topic?.status, topic?.end_at, language]);

  useEffect(() => {
    if (!topic) return;
    const isEnded = topic.status === "ended" || (topic.end_at && new Date(topic.end_at) <= new Date());
    if (!isEnded) return;

    let mounted = true;

    const load = async () => {
      try {
        setError(null);
        // 僅讀取已有結語時不顯示 loading，避免「等待系統回應」
        const data = await fetchClosing(topic.id, language);
        if (mounted) setStatement(data);
      } catch (e: any) {
        console.error("AI closing statement error:", e);
        if (mounted) setError(e?.message ?? "Failed to load");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [topic?.id, topic?.status, language]);

  /** 手動觸發產生混亂結語（已結束主題且尚無結語時可用，不需等排程）。已產生結語則不再呼叫 API。 */
  const triggerGenerate = useCallback(async (): Promise<{ success: boolean; generated?: boolean; error?: string }> => {
    if (!topic?.id) return { success: false, generated: false, error: "No topic" };
    const isEnded = topic.status === "ended" || (topic.end_at && new Date(topic.end_at) <= new Date());
    if (!isEnded) return { success: false, generated: false, error: "Topic not ended" };
    if (statement) return { success: true, generated: false };
    try {
      setIsGenerating(true);
      setError(null);
      const { data, error: invokeErr } = await supabase.functions.invoke("generate-ai-closing", {
        body: { topic_id: topic.id },
        method: "POST",
      });
      if (invokeErr) {
        setError(invokeErr.message);
        return { success: false, generated: false, error: invokeErr.message };
      }
      if (data?.error) {
        setError(data.error);
        return { success: false, generated: false, error: data.error };
      }
      if (data?.success && data?.data) {
        const raw = data.data as RawRow;
        setStatement({
          id: raw.id,
          topic_id: raw.topic_id,
          content: resolveContentByLanguage(raw, language),
          created_at: raw.created_at,
        });
        return { success: true, generated: true };
      }
      const refreshed = await fetchClosing(topic.id, language);
      setStatement(refreshed);
      return { success: !!refreshed, generated: !!refreshed };
    } catch (e: any) {
      const msg = e?.message ?? "Failed to generate";
      setError(msg);
      return { success: false, generated: false, error: msg };
    } finally {
      setIsGenerating(false);
    }
  }, [topic?.id, topic?.status, topic?.end_at, statement, language]);

  return { statement, isLoading, isGenerating, error, triggerGenerate, refetch };
};
