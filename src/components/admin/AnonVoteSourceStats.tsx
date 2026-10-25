import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Row = { topic_id: string; title: string; src: string; anon_votes: number };

export default function AnonVoteSourceStats() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["anon-vote-source-stats"],
    queryFn: async () => {
      const { data: rows, error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
      ) => Promise<{ data: Row[] | null; error: { message: string } | null }>)("get_anon_vote_source_stats");
      if (rpcError) throw new Error(rpcError.message);
      return rows ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">載入中…</p>;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">還沒有匿名票。</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2 pr-3">主題</th>
          <th className="py-2 pr-3">來源</th>
          <th className="py-2">匿名票</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={`${row.topic_id}-${row.src}`} className="border-b border-border/60">
            <td className="py-2 pr-3">{row.title}</td>
            <td className="py-2 pr-3">{row.src}</td>
            <td className="py-2">{Number(row.anon_votes).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
