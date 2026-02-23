import { useState, useEffect } from "react";
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

export const useAiClosingStatement = (topic: TopicData | null) => {
  const [statement, setStatement] = useState<AiClosingStatement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topic) return;
    const isEnded = topic.status === "ended" || (topic.end_at && new Date(topic.end_at) <= new Date());
    if (!isEnded) return;

    let mounted = true;

    const fetchOrGenerate = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: existing, error: fetchErr } = await supabase
          .from("topic_ai_summary")
          .select("id, topic_id, content, created_at")
          .eq("topic_id", topic.id)
          .maybeSingle();

        if (fetchErr && fetchErr.code !== "PGRST116") {
          console.error("Fetch AI closing error:", fetchErr);
        }

        if (existing) {
          if (mounted) setStatement(existing as AiClosingStatement);
          setIsLoading(false);
          return;
        }

        const { data: result, error: invokeErr } = await supabase.functions.invoke("generate-ai-closing", {
          body: { topic_id: topic.id },
        });

        if (invokeErr) throw invokeErr;

        if (result?.success && result?.data) {
          if (mounted) setStatement(result.data as AiClosingStatement);
        } else if (result?.error) {
          throw new Error(result.error);
        }
      } catch (e: any) {
        console.error("AI closing statement error:", e);
        if (mounted) setError(e?.message ?? "Failed to load");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchOrGenerate();
    return () => { mounted = false; };
  }, [topic?.id, topic?.status]);

  return { statement, isLoading, error };
};
