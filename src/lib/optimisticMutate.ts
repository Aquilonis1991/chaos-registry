export type OptimisticMutateResult<T> = { ok: true; result: T } | { ok: false; error: unknown };

/**
 * apply() 先同步套用樂觀狀態；run() 失敗則保證只 rollback() 一次；
 * 成功則呼叫 reconcile()（例如依實際回傳值修正樂觀數值），取代各呼叫點各自維護的
 * `optimisticUpdateApplied` 旗標。
 */
export async function optimisticMutate<T>(opts: {
  apply: () => void;
  rollback: () => void;
  run: () => Promise<T>;
  reconcile?: (result: T) => void;
}): Promise<OptimisticMutateResult<T>> {
  const { apply, rollback, run, reconcile } = opts;
  apply();
  try {
    const result = await run();
    reconcile?.(result);
    return { ok: true, result };
  } catch (error) {
    rollback();
    return { ok: false, error };
  }
}
