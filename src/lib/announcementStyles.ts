/**
 * 公告輪播背景配色（8 種預設，對應 DB style_preset 1～8）
 */
export const ANNOUNCEMENT_STYLE_PRESETS = [
  { id: 1, label: "玫瑰暮光", className: "bg-gradient-to-r from-rose-500 to-orange-400" },
  { id: 2, label: "深海藍紫", className: "bg-gradient-to-r from-blue-600 to-violet-500" },
  { id: 3, label: "翠綠薄荷", className: "bg-gradient-to-r from-emerald-500 to-cyan-400" },
  { id: 4, label: "琥珀夕陽", className: "bg-gradient-to-r from-amber-500 to-red-500" },
  { id: 5, label: "午夜靛青", className: "bg-gradient-to-r from-indigo-700 to-slate-600" },
  { id: 6, label: "櫻粉薰衣草", className: "bg-gradient-to-r from-pink-500 to-purple-500" },
  { id: 7, label: "苔蘚森林", className: "bg-gradient-to-r from-lime-600 to-green-700" },
  { id: 8, label: "銀灰金屬", className: "bg-gradient-to-r from-slate-500 to-zinc-600" },
] as const;

export type AnnouncementStylePresetId = (typeof ANNOUNCEMENT_STYLE_PRESETS)[number]["id"];

export function getAnnouncementStyleClass(preset: number | null | undefined): string {
  const id = typeof preset === "number" && preset >= 1 && preset <= 8 ? preset : 1;
  const found = ANNOUNCEMENT_STYLE_PRESETS.find((p) => p.id === id);
  return found?.className ?? ANNOUNCEMENT_STYLE_PRESETS[0].className;
}

/** 後台／DB 使用之分類值 */
export const ANNOUNCEMENT_CATEGORIES = ["重要", "一般", "節慶", "活動", "其他"] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];
