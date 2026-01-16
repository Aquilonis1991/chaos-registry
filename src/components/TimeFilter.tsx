import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

export type TimeFilterOption = '1day' | '1week' | '1month' | '3months' | '6months' | '1year';

export interface TimeFilterProps {
  value: TimeFilterOption | null;
  onChange: (value: TimeFilterOption | null) => void;
  className?: string;
  showAdminOnly?: boolean; // 是否顯示管理員專用選項（1年以前）
  isAdmin?: boolean; // 是否為管理員
}

const timeFilterOptions: Array<{
  value: TimeFilterOption;
  labelKey: string;
  days: number;
  adminOnly?: boolean;
}> = [
  { value: '1day', labelKey: 'timeFilter.option.1day', days: 1 },
  { value: '1week', labelKey: 'timeFilter.option.1week', days: 7 },
  { value: '1month', labelKey: 'timeFilter.option.1month', days: 30 },
  { value: '3months', labelKey: 'timeFilter.option.3months', days: 90 },
  { value: '6months', labelKey: 'timeFilter.option.6months', days: 180 },
  { value: '1year', labelKey: 'timeFilter.option.1year', days: 365 },
];

export const TimeFilter = ({ 
  value, 
  onChange, 
  className = "",
  showAdminOnly = false,
  isAdmin = false
}: TimeFilterProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  
  const selectedOption = timeFilterOptions.find(opt => opt.value === value);
  const displayLabel = selectedOption 
    ? getText(selectedOption.labelKey, selectedOption.value)
    : getText('timeFilter.option.all', '全部');

  // 過濾選項：如果不是管理員，不顯示需要管理員權限的選項
  const availableOptions = timeFilterOptions.filter(opt => {
    if (opt.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
        >
          <Calendar className="w-4 h-4" />
          <span>{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        <div className="space-y-1">
          <button
            onClick={() => onChange(null)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors flex items-center justify-between",
              value === null && "bg-accent"
            )}
          >
            <span>{getText('timeFilter.option.all', '全部')}</span>
            {value === null && <Check className="w-4 h-4" />}
          </button>
          {availableOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors flex items-center justify-between",
                value === option.value && "bg-accent",
                option.adminOnly && !isAdmin && "opacity-50 cursor-not-allowed"
              )}
              disabled={option.adminOnly && !isAdmin}
            >
              <span>{getText(option.labelKey, option.value)}</span>
              {value === option.value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/**
 * 根據時間篩選選項計算開始日期
 */
export const getStartDateFromFilter = (filter: TimeFilterOption | null): Date | null => {
  if (!filter) return null;
  
  const option = timeFilterOptions.find(opt => opt.value === filter);
  if (!option) return null;
  
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - option.days);
  return startDate;
};

/**
 * 檢查日期是否在1年以前（需要管理員權限）
 */
export const isOlderThanOneYear = (date: Date): boolean => {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return date < oneYearAgo;
};
