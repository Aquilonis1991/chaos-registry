/**
 * 版本號比較（支援 x.y.z 格式）
 * @returns true 表示 current >= minimum（不需強制更新）
 */
export function isVersionAtLeast(current: string, minimum: string): boolean {
  const cur = parseVersion(current);
  const min = parseVersion(minimum);
  if (!cur.length || !min.length) return true; // 解析失敗時不阻擋
  const len = Math.max(cur.length, min.length);
  for (let i = 0; i < len; i++) {
    const c = cur[i] ?? 0;
    const m = min[i] ?? 0;
    if (c > m) return true;
    if (c < m) return false;
  }
  return true; // 相等
}

function parseVersion(v: string): number[] {
  if (!v || typeof v !== 'string') return [];
  return v
    .trim()
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));
}
