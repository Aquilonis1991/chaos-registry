
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TopicSummary } from '@/components/OfficialSummaryCard';

interface TopicData {
    id: string;
    title: string;
    options: any[];
    total_votes?: number;
    status: string;
}

export const useOfficialSummary = (topic: TopicData | null) => {
    const [summary, setSummary] = useState<TopicSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Only proceed if topic exists and is ended
        if (!topic || topic.status !== 'ended') {
            return;
        }

        let isMounted = true;

        const fetchOrGenerateSummary = async () => {
            try {
                setError(null);
                // 1. Check if summary exists in DB（先不設 loading，已有總結時不顯示「等待系統回應」）
                const { data: existingData, error: dbError } = await supabase
                    .from('topic_summaries' as any)
                    .select('*')
                    .eq('topic_id', topic.id)
                    .maybeSingle();

                if (dbError && dbError.code !== 'PGRST116') {
                    console.error('Error fetching summary:', dbError);
                }

                if (existingData) {
                    if (isMounted) {
                        setSummary(existingData as unknown as TopicSummary);
                    }
                    return;
                }

                // 2. 尚無總結時才顯示 loading 並觸發 AI 產生
                if (isMounted) setIsLoading(true);
                const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-topic-summary', {
                    body: {
                        topic_id: topic.id,
                        title: topic.title,
                        options: topic.options,
                        votes: { total: topic.total_votes || 0 }
                    }
                });

                if (aiError) {
                    throw aiError;
                }

                if (aiData?.success && aiData?.data) {
                    // The edge function inserts into DB, but we use the returned data for UI
                    // Match the interface
                    const newSummary: TopicSummary = {
                        id: 'temp-id', // Or real ID if returned
                        topic_id: topic.id,
                        summary_zh: aiData.data.summary_zh,
                        summary_en: aiData.data.summary_en,
                        summary_ja: aiData.data.summary_ja,
                        chaos_level: 'IV',
                        created_at: new Date().toISOString()
                    };

                    if (isMounted) {
                        setSummary(newSummary);
                    }
                }

            } catch (err: any) {
                console.error('Failed to generate summary:', err);
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchOrGenerateSummary();

        return () => {
            isMounted = false;
        };
    }, [topic?.id, topic?.status]); // Re-run only if topic ID or status changes

    return { summary, isLoading, error };
};
