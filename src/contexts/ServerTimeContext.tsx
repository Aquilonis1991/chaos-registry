import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

type ServerTimeContextValue = {
  /** 伺服器時間 − 本地 Date.now()（毫秒），未同步前為 0 */
  offsetMs: number;
  /** 已成功自 DB 取得至少一次時間 */
  isSynced: boolean;
  /** 與資料庫對齊的「現在」 */
  getNow: () => Date;
  getNowMs: () => number;
  resync: () => Promise<void>;
};

const ServerTimeContext = createContext<ServerTimeContextValue | null>(null);

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

async function fetchServerOffsetMs(): Promise<number> {
  const t1 = Date.now();
  const { data, error } = await supabase.rpc("get_server_time");
  const t2 = Date.now();
  if (error) throw error;
  if (data == null) throw new Error("get_server_time returned null");
  const serverMs = new Date(data as string).getTime();
  if (Number.isNaN(serverMs)) throw new Error("Invalid server time");
  const roundTrip = t2 - t1;
  const localMid = t1 + roundTrip / 2;
  return Math.round(serverMs - localMid);
}

export function ServerTimeProvider({ children }: { children: ReactNode }) {
  const [offsetMs, setOffsetMs] = useState(0);
  const [isSynced, setIsSynced] = useState(false);
  const mounted = useRef(true);

  const resync = useCallback(async () => {
    try {
      const next = await fetchServerOffsetMs();
      if (!mounted.current) return;
      setOffsetMs(next);
      setIsSynced(true);
    } catch (e) {
      console.warn("[ServerTime] sync failed, using local clock:", e);
      if (mounted.current) {
        setOffsetMs(0);
        setIsSynced(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void resync();
    const id = window.setInterval(() => void resync(), SYNC_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void resync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [resync]);

  const getNowMs = useCallback(() => Date.now() + offsetMs, [offsetMs]);

  const getNow = useCallback(() => new Date(getNowMs()), [getNowMs]);

  const value = useMemo(
    () => ({ offsetMs, isSynced, getNow, getNowMs, resync }),
    [offsetMs, isSynced, getNow, getNowMs, resync]
  );

  return <ServerTimeContext.Provider value={value}>{children}</ServerTimeContext.Provider>;
}

export function useServerTime(): ServerTimeContextValue {
  const ctx = useContext(ServerTimeContext);
  if (!ctx) {
    throw new Error("useServerTime must be used within ServerTimeProvider");
  }
  return ctx;
}
