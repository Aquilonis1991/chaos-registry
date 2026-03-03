import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const fetchClosing = async (topicId: string) => {
  const { data, error } = await supabase
    .from("topic_ai_summary")
    .select("id, topic_id, content, created_at")
    .eq("topic_id", topicId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data as AiClosingStatement | null;
};

export const useAiClosingStatement = (topic: TopicData | null) => {
  const [statement, setStatement] = useState<AiClosingStatement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!topic?.id) return;
    const isEnded = topic.status === "ended" || (topic.end_at && new Date(topic.end_at) <= new Date());
    if (!isEnded) return;
    const data = await fetchClosing(topic.id);
    setStatement(data);
  }, [topic?.id, topic?.status, topic?.end_at]);

  useEffect(() => {
    if (!topic) return;
    const isEnded = topic.status === "ended" || (topic.end_at && new Date(topic.end_at) <= new Date());
    if (!isEnded) return;

    let mounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchClosing(topic.id);
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
  }, [topic?.id, topic?.status]);

  /** 手動觸發產生混亂結語（已結束主題且尚無結語時可用，不需等排程） */
  const triggerGenerate = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!topic?.id) return { success: false, error: "No topic" };
    const isEnded = topic.status === "ended" || (topic.end_at && new Date(topic.end_at) <= new Date());
    if (!isEnded) return { success: false, error: "Topic not ended" };
    try {
      setIsGenerating(true);
      setError(null);
      const { data, error: invokeErr } = await supabase.functions.invoke("generate-ai-closing", {
        body: { topic_id: topic.id },
        method: "POST",
      });
      if (invokeErr) {
        setError(invokeErr.message);
        return { success: false, error: invokeErr.message };
      }
      if (data?.error) {
        setError(data.error);
        return { success: false, error: data.error };
      }
      if (data?.success && data?.data) {
        setStatement(data.data as AiClosingStatement);
        return { success: true };
      }
      const refreshed = await fetchClosing(topic.id);
      setStatement(refreshed);
      return { success: !!refreshed };
    } catch (e: any) {
      const msg = e?.message ?? "Failed to generate";
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsGenerating(false);
    }
  }, [topic?.id, topic?.status, topic?.end_at]);

  return { statement, isLoading, isGenerating, error, triggerGenerate, refetch };
};
