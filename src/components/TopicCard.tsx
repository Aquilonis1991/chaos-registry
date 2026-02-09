import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Clock, User } from "lucide-react";
import { Link } from "react-router-dom";
import { getTagColor } from "@/lib/tagColors";
import { cn } from "@/lib/utils";
import { formatCompactNumber } from "@/lib/numberFormat";

interface TopicCardProps {
  id: string;
  title: string;
  tags: string[];
  voteCount: number;
  creatorName: string;
  isHot?: boolean;
  createdAt?: string;
  currentExposureLevel?: 'normal' | 'medium' | 'high' | string | null;
}

export const TopicCard = ({ id, title, tags, voteCount, creatorName, isHot, createdAt, currentExposureLevel }: TopicCardProps) => {
  // 首頁主題卡片曝光等級樣式
  // 普通：無邊 + 接近白的灰；中等：普通樣式 + 黃框；高級：黃邊 + 淡黃白漸層（原中等樣式）
  const level = typeof currentExposureLevel === 'string' ? currentExposureLevel.trim().toLowerCase() : '';
  const exposureStyles = (level === 'high')
    ? "border-yellow-500/50 !bg-gradient-to-br from-yellow-500/10 via-yellow-400/5 to-transparent shadow-md shadow-yellow-500/10"
    : (level === 'medium')
      ? "border-yellow-500/50 !bg-gradient-to-br from-gray-100 to-transparent dark:from-gray-800/50 dark:to-transparent"
      : (level === 'normal')
        ? "border-0 !bg-gradient-to-br from-gray-100 to-transparent dark:from-gray-800/50 dark:to-transparent"
        : "border-primary/50 !bg-gradient-to-br from-primary/5 to-transparent shadow-card";

  return (
    <Link to={`/vote/${id}`}>
      <Card className={cn(
        "border cursor-pointer active:scale-100 transition-none",
        exposureStyles
      )}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-bold text-foreground flex-1 line-clamp-2">
              {title}
            </h3>
            {isHot && (
              <Flame className="w-5 h-5 text-accent ml-2 flex-shrink-0" />
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <Badge
                key={tag}
                className={`text-xs font-medium border-0 ${getTagColor(tag)}`}
              >
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
    </Link>
  );
};
