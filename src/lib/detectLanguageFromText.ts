import type { BaseLanguage } from "@/contexts/LanguageContext";

/**
 * 依「大部分文字」偵測主要語言：計算日文假名、CJK、英文字母字數，取最多者。
 * 用於混亂結語等：標題多為英文→英文結語，多為日文假名→日文，否則繁中。
 */
export function detectLanguageFromText(text: string): BaseLanguage {
  const s = (text || "").trim();
  if (!s) return "zh";

  const kanaRegex = /[\u3040-\u30ff]/g;
  const cjkRegex = /[\u4e00-\u9fff]/g;
  const latinRegex = /[a-zA-Z]/g;

  const jaCount = (s.match(kanaRegex) || []).length;
  const zhCount = (s.match(cjkRegex) || []).length;
  const enCount = (s.match(latinRegex) || []).length;

  if (jaCount >= zhCount && jaCount >= enCount && jaCount > 0) return "ja";
  if (enCount >= zhCount && enCount >= jaCount && enCount > 0) return "en";
  return "zh";
}
