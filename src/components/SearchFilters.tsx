import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Filter, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

interface SearchFiltersProps {
  onApplyFilters: (filters: any) => void;
  selectedTags?: string[];
}

export const SearchFilters = ({ onApplyFilters, selectedTags = [] }: SearchFiltersProps) => {
  const [tags, setTags] = useState<string[]>(selectedTags);
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  const triggerLabel = getText('home.search.filters.trigger', '篩選');
  const sheetTitle = getText('home.search.filters.title', '搜尋篩選');
  const sheetDescription = getText('home.search.filters.description', '選擇標籤來縮小搜尋範圍');
  const tagFilterLabel = getText('home.search.filters.tagLabel', '標籤篩選');
  const clearTagsTemplate = getText('home.search.filters.clear', '清除 ({{count}})');
  const resetLabel = getText('home.search.filters.reset', '重置');
  const applyLabel = getText('home.search.filters.apply', '套用篩選');
  const applyLabelWithCount = getText('home.search.filters.applyWithCount', '套用篩選 ({{count}})');

  // 可用標籤（從系統中常用的標籤）
  const availableTags = [
    // 生活類
    "美食", "旅遊", "運動", "健康", "時尚", "寵物",
    // 娛樂類
    "電影", "音樂", "遊戲", "動漫", "綜藝", "明星",
    // 科技類
    "科技", "AI", "手機", "電腦", "軟體", "程式",
    // 社會類
    "時事", "政治", "經濟", "教育", "環保", "公益",
    // 興趣類
    "閱讀", "攝影", "手作", "烹飪", "園藝", "收藏",
  ];

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const handleApply = () => {
    onApplyFilters({
      tags: tags.length > 0 ? tags : undefined,
    });
    setIsOpen(false);
  };

  const handleReset = () => {
    setTags([]);
    onApplyFilters({});
  };

  const activeFilterCount = tags.length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="w-4 h-4 mr-2" />
          {triggerLabel}
          {activeFilterCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>
            {sheetDescription}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* 標籤篩選 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{tagFilterLabel}</Label>
              {tags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTags([])}
                  className="h-7 text-xs"
                >
                  {clearTagsTemplate.replace('{{count}}', tags.length.toString())}
                </Button>
              )}
            </div>

            {/* 已選擇的標籤 */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="default"
                    className="flex items-center gap-1 pr-1"
                  >
                    #{tag}
                    <button
                      onClick={() => toggleTag(tag)}
                      className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* 可選標籤 */}
            <div className="flex flex-wrap gap-2">
              {availableTags
                .filter(tag => !tags.includes(tag))
                .map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => toggleTag(tag)}
                  >
                    #{tag}
                  </Badge>
                ))}
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex-1"
          >
            {resetLabel}
          </Button>
          <Button
            onClick={handleApply}
            className="flex-1"
          >
            {activeFilterCount > 0
              ? applyLabelWithCount.replace('{{count}}', activeFilterCount.toString())
              : applyLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

