const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * 將大型數字格式化為易讀的縮寫（例如 1.2K、3.4M）
 */
export const formatCompactNumber = (value: number | null | undefined) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue === 0) {
    return '0';
  }

  const absValue = Math.abs(numericValue);

  if (absValue < 1000) {
    return numericValue.toLocaleString();
  }

  return compactFormatter.format(numericValue);
};


