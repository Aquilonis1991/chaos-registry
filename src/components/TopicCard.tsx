import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, User, CheckCircle2, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { getTagColor } from "@/lib/tagColors";
import { cn } from "@/lib/utils";
import { formatCompactNumber } from "@/lib/numberFormat";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { TopicShareDialog } from "@/components/TopicShareDialog";

interface TopicCardProps {
  id: string;
  title: string;
  tags: string[];
  voteCount: number;
  creatorName: string;
  isHot?: boolean;
  isEnded?: boolean;
  createdAt?: string;
  endAt?: string;
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
  endedLabel,
  endedSuffixLabel,
  createdAt,
  isUrgentCountdown,
  urgentMinutes,
  urgentTagLabel,
  urgentCountdownTemplate,
  getTagColor,
}: {
  title: string;
  tags: string[];
  voteCount: number;
  creatorName: string;
  isHot?: boolean;
  isEnded?: boolean;
  endedLabel?: string;
  endedSuffixLabel?: string;
  createdAt?: string;
  isUrgentCountdown?: boolean;
  urgentMinutes?: number | null;
  urgentTagLabel: string;
  urgentCountdownTemplate: string;
  getTagColor: (tag: string) => string;
}) {
  const label = endedLabel ?? '已結束';
  const endedSuffix = endedSuffixLabel ?? '（已結束）';
  return (
    <>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground flex-1 line-clamp-2">{title}</h3>
            {isUrgentCountdown && (
              <span className="inline-flex items-center rounded text-xs font-semibold px-2 py-0.5 bg-[#FF4D94] text-white whitespace-nowrap mt-0.5">
                {urgentTagLabel}
              </span>
            )}
          </div>
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
          <div className={cn("flex items-center gap-1", isUrgentCountdown ? "text-[#FF4D94] font-semibold" : "text-muted-foreground")}>
            {!isUrgentCountdown && <Clock className="w-4 h-4" />}
            <span>
              {isUrgentCountdown
                ? urgentCountdownTemplate.replace('{{count}}', Math.max(1, urgentMinutes ?? 1).toString())
                : createdAt}
            </span>
            {isEnded && <span>{endedSuffix}</span>}
          </div>
        )}
      </div>
    </>
  );
}

export const TopicCard = ({ id, title, tags, voteCount, creatorName, isHot, isEnded, createdAt, endAt, currentExposureLevel }: TopicCardProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const endedLabel = getText('home.topicCard.ended', '已結束');
  const endedSuffixLabel = getText('home.topicCard.endedSuffix', '（已結束）');
  const urgentTagLabel = getText('home.topicCard.urgentTag', '🔥 倒數中');
  const urgentCountdownTemplate = getText('common.time.urgentMinutes', '⌛ 剩餘 {{count}} 分鐘');
  const shareAriaLabel = getText('topic.share.button.aria', '分享主題');
  const [shareOpen, setShareOpen] = useState(false);

  const level = typeof currentExposureLevel === 'string' ? currentExposureLevel.trim().toLowerCase() : '';
  const normalizedLevel = level === 'low' ? 'normal' : level;
  if (normalizedLevel === 'high' || normalizedLevel === 'medium') exposureLevelByTopicId.set(id, normalizedLevel);
  const levelRef = useRef<string>(normalizedLevel || exposureLevelByTopicId.get(id) || 'normal');
  if (normalizedLevel === 'high' || normalizedLevel === 'medium') levelRef.current = normalizedLevel;
  const effectiveLevel = normalizedLevel || exposureLevelByTopicId.get(id) || levelRef.current || 'normal';

  const exposureStyle = getExposureContainerStyle(effectiveLevel);
  const isExposureCard = effectiveLevel === 'high' || effectiveLevel === 'medium';
  const endAtMs = endAt ? new Date(endAt).getTime() : Number.NaN;
  const remainingMinutes =
    !isEnded && Number.isFinite(endAtMs) ? Math.ceil((endAtMs - Date.now()) / 60000) : null;
  const isUrgentCountdown =
    remainingMinutes !== null && remainingMinutes > 0 && remainingMinutes <= 60;

  const content = (
    <TopicCardContent
      title={title}
      tags={tags}
      voteCount={voteCount}
      creatorName={creatorName}
      isHot={isHot}
      isEnded={isEnded}
      endedLabel={endedLabel}
      endedSuffixLabel={endedSuffixLabel}
      createdAt={createdAt}
      isUrgentCountdown={isUrgentCountdown}
      urgentMinutes={remainingMinutes}
      urgentTagLabel={urgentTagLabel}
      urgentCountdownTemplate={urgentCountdownTemplate}
      getTagColor={getTagColor}
    />
  );

  return (
    <div className="relative">
      <TopicShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        topicId={id}
        topicTitle={title}
      />
      <button
        type="button"
        className="absolute top-2 right-2 z-20 flex h-6 w-6 items-center justify-center rounded-md bg-[#FF4D94]/15 text-[#FF4D94] hover:bg-[#FF4D94]/25 active:scale-95"
        aria-label={shareAriaLabel}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShareOpen(true);
        }}
      >
        <Share2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </button>
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
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground flex-1 line-clamp-2">{title}</h3>
                {isUrgentCountdown && (
                  <span className="inline-flex items-center rounded text-xs font-semibold px-2 py-0.5 bg-[#FF4D94] text-white whitespace-nowrap mt-0.5">
                    {urgentTagLabel}
                  </span>
                )}
              </div>
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
              <div className={cn("flex items-center gap-1", isUrgentCountdown ? "text-[#FF4D94] font-semibold" : "text-muted-foreground")}>
                {!isUrgentCountdown && <Clock className="w-4 h-4" />}
                <span>
                  {isUrgentCountdown
                    ? urgentCountdownTemplate.replace('{{count}}', Math.max(1, remainingMinutes ?? 1).toString())
                    : createdAt}
                </span>
                {isEnded && <span>{endedSuffixLabel}</span>}
              </div>
            )}
          </CardFooter>
        </Card>
      )}
      </Link>
    </div>
  );
};
