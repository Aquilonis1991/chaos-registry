export async function timedRpc<T>(
  fn: () => Promise<T>,
  opts: { timeoutMs?: number; timeoutMessage?: string } = {}
): Promise<T> {
  const { timeoutMs = 30000, timeoutMessage = '查詢超時，請稍後再試' } = opts;
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)),
  ]);
}
