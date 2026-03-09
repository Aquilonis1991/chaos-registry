import { useRef } from "react";
import type { CSSProperties } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, User, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { getTagColor } from "@/lib/tagColors";
import { cn } from "@/lib/utils";
import { formatCompactNumber } from "@/lib/numberFormat";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

interface TopicCardProps {
  id: string;
  title: string;
  tags: string[];
  voteCount: number;
  creatorName: string;
  isHot?: boolean;
  isEnded?: boolean;
  createdAt?: string;
  currentExposureLevel?: 'normal' | 'medium' | 'high' | string | null;
}

// 與發起主題頁「高級／中等曝光」按鈕一致。根本作法：曝光卡「不用 Card 組件」，
// 單一 div + inline 樣式承載漸層與內容，DOM 中無 bg-card，無任何內層可覆蓋顏色。
const EXPOSURE = {
  borderWidth: 1,
  borderColor: 'rgba(234, 179, 8, 0.5)',
  backgroundHigh: 'linear-gradient(to bottom right, rgba(234,179,8,0.1), rgba(250,204,21,0.05), transparent)',
  shadowHigh: '0 4px 6px -1px rgba(234,179,8,0.1), 0 2px 4px -2px rgba(234,179,8,0.08)',
  backgroundMedium: 'linear-gradient(to bottom right, rgb(243, 244, 246), transparent)',
  zIndex: 10,
  position: 'relative' as const,
} as const;

// 依 topic id 快取曝光等級：列表重排或重掛載後仍能顯示正確顏色（避免「閃一下就被蓋掉」）
const exposureLevelByTopicId = new Map<string, 'high' | 'medium'>();

function getExposureContainerStyle(level: string): CSSProperties | undefined {
  const base: CSSProperties = {
    borderWidth: EXPOSURE.borderWidth,
    borderStyle: 'solid',
    borderColor: EXPOSURE.borderColor,
    borderRadius: 'var(--radius, 0.5rem)',
    position: EXPOSURE.position,
    zIndex: EXPOSURE.zIndex,
    cursor: 'pointer',
    isolation: 'isolate' as const,
    transform: 'translateZ(0)',
    willChange: 'transform',
  };
  if (level === 'high')
    return { ...base, background: EXPOSURE.backgroundHigh, boxShadow: EXPOSURE.shadowHigh };
  if (level === 'medium')
    return { ...base, background: EXPOSURE.backgroundMedium };
  return undefined;
}

// 共用的卡片內容（標題、標籤、投票數、建立者、時間）
function TopicCardContent({
  title,
  tags,
  voteCount,
  creatorName,
  isHot,
  isEnded,
  createdAt,
  getTagColor,
}: {
  title: string;
  tags: string[];
  voteCount: number;
  creatorName: string;
  isHot?: boolean;
  isEnded?: boolean;
  endedLabel?: string;
  createdAt?: string;
  getTagColor: (tag: string) => string;
}) {
  const label = endedLabel ?? '已結束';
  return (
    <>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-bold text-foreground flex-1 line-clamp-2">{title}</h3>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            {isEnded && (
              <CheckCircle2 className="w-5 h-5 text-muted-foreground" title={label} aria-label={label} />
            )}
            {isHot && <Flame className="w-5 h-5 text-accent" />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag) => (
            <Badge key={tag} className={cn("text-xs font-medium border-0", getTagColor(tag))}>
              #{tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center px-5 py-3 bg-muted/30 justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-primary font-semibold">
            <Flame className="w-4 h-4" />
            <span>{formatCompactNumber(voteCount)}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="w-4 h-4" />
            <span>{creatorName}</span>
          </div>
        </div>
        {createdAt && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{createdAt}</span>
          </div>
        )}
      </div>
    </>
  );
}

export const TopicCard = ({ id, title, tags, voteCount, creatorName, isHot, isEnded, createdAt, currentExposureLevel }: TopicCardProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const endedLabel = getText('home.topicCard.ended', '已結束');

  const level = typeof currentExposureLevel === 'string' ? currentExposureLevel.trim().toLowerCase() : '';
  const normalizedLevel = level === 'low' ? 'normal' : level;
  if (normalizedLevel === 'high' || normalizedLevel === 'medium') exposureLevelByTopicId.set(id, normalizedLevel);
  const levelRef = useRef<string>(normalizedLevel || exposureLevelByTopicId.get(id) || 'normal');
  if (normalizedLevel === 'high' || normalizedLevel === 'medium') levelRef.current = normalizedLevel;
  const effectiveLevel = normalizedLevel || exposureLevelByTopicId.get(id) || levelRef.current || 'normal';

  const exposureStyle = getExposureContainerStyle(effectiveLevel);
  const isExposureCard = effectiveLevel === 'high' || effectiveLevel === 'medium';

  const content = (
    <TopicCardContent
      title={title}
      tags={tags}
      voteCount={voteCount}
      creatorName={creatorName}
      isHot={isHot}
      isEnded={isEnded}
      endedLabel={endedLabel}
      createdAt={createdAt}
      getTagColor={getTagColor}
    />
  );

  return (
    <Link to={`/vote/${id}`} className="block">
      {/* 高級/中等曝光卡：僅用 div + inline style，絕不使用 Card，避免 bg-card 蓋掉漸層（下次 AAB 請保持此分支無 Card） */}
      {isExposureCard && exposureStyle ? (
        <div
          style={exposureStyle}
          className="rounded-lg overflow-hidden active:scale-100 transition-none"
          data-exposure-level={effectiveLevel}
        >
          {content}
        </div>
      ) : (
        <Card
          className={cn(
            "cursor-pointer active:scale-100 transition-none border-0 !bg-gradient-to-br from-gray-100 to-transparent dark:from-gray-800/50 dark:to-transparent"
          )}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-bold text-foreground flex-1 line-clamp-2">{title}</h3>
              <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                {isEnded && (
                  <CheckCircle2 className="w-5 h-5 text-muted-foreground" title={endedLabel} aria-label={endedLabel} />
                )}
                {isHot && <Flame className="w-5 h-5 text-accent" />}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <Badge key={tag} className={cn("text-xs font-medium border-0", getTagColor(tag))}>
                  #{tag}
                </Badge>
              ))}
            </div>
          </CardContent>
          <CardFooter className="px-5 py-3 bg-muted/30 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-primary font-semibold">
                <Flame className="w-4 h-4" />
                <span>{formatCompactNumber(voteCount)}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <User className="w-4 h-4" />
                <span>{creatorName}</span>
              </div>
            </div>
            {createdAt && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{createdAt}</span>
              </div>
            )}
          </CardFooter>
        </Card>
      )}
    </Link>
  );
};
