import { useState, useEffect, useMemo, type TouchEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  X, 
  Calendar, 
  Star,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { getAnnouncementStyleClass } from "@/lib/announcementStyles";
import { useServerTime } from "@/contexts/ServerTimeContext";

interface Announcement {
  id: string;
  title: string;
  content: string;
  summary?: string;
  image_url?: string;
  priority: number;
  click_count: number;
  created_at: string;
  announcement_category?: string;
  style_preset?: number;
  display_date?: string | null;
}

interface AnnouncementCarouselProps {
  className?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
}

export const AnnouncementCarousel = ({ 
  className, 
  showCloseButton = true, 
  onClose 
}: AnnouncementCarouselProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [isTouching, setIsTouching] = useState(false);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [swipeFxOffset, setSwipeFxOffset] = useState(0);

  const { getNow, offsetMs } = useServerTime();
  const { getConfig, loading: configLoading, configs } = useSystemConfigCache();
  const announcementMaxDisplay = useMemo(() => {
    const raw = getConfig<number>("announcement_max_display", 3);
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 3;
    return Math.min(Math.max(Math.floor(n), 1), 50);
  }, [configs]);

  useEffect(() => {
    if (configLoading) return;
    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await supabase.rpc("get_active_announcements", {
          limit_count: announcementMaxDisplay,
        });
        if (error) throw error;
        setAnnouncements(data || []);
      } catch (error) {
        console.error("Error fetching announcements:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, [configLoading, announcementMaxDisplay]);

  const DISMISS_STORAGE_KEY = "announcement_banner_dismissed";
  /** 以伺服器對齊後的「本地日曆日」作為今日 key（與使用者時區一致） */
  const getTodayStr = () => {
    const d = getNow();
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (stored === getTodayStr()) {
        setIsDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, [offsetMs, getNow]);

  const handleAnnouncementClick = async (announcement: Announcement) => {
    try {
      // Increment click count
      await supabase.rpc('increment_announcement_clicks', {
        announcement_id: announcement.id
      });
    } catch (error) {
      console.error('Error incrementing click count:', error);
    }

    setSelectedAnnouncement(announcement);
    setIsDialogOpen(true);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? announcements.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) => 
      prev === announcements.length - 1 ? 0 : prev + 1
    );
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, getTodayStr());
    } catch {
      /* ignore */
    }
    setIsDismissed(true);
    onClose?.();
  };

  const SWIPE_THRESHOLD = 40;
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setIsTouching(true);
    setTouchStartX(e.touches[0].clientX);
    setTouchEndX(null);
    setDragDeltaX(0);
    setSwipeFxOffset(0);
  };
  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    const x = e.touches[0].clientX;
    setTouchEndX(x);
    if (touchStartX !== null) {
      setDragDeltaX(x - touchStartX);
    }
  };
  const handleTouchEnd = () => {
    setIsTouching(false);
    const delta = touchStartX !== null && touchEndX !== null ? touchStartX - touchEndX : 0;

    if (announcements.length <= 1 || touchStartX === null || touchEndX === null) return;
    if (Math.abs(delta) < SWIPE_THRESHOLD) {
      setDragDeltaX(0);
      return;
    }
    if (delta > 0) {
      handleNext();
      setSwipeFxOffset(-10);
    } else {
      handlePrev();
      setSwipeFxOffset(10);
    }
    window.setTimeout(() => setSwipeFxOffset(0), 180);
    setDragDeltaX(0);
  };

    const getCategoryBadge = (a: Announcement, variant: "onGradient" | "onLight" = "onGradient") => {
    const cat = a.announcement_category?.trim() || getText("announcement.badge.default", "一般");
    if (variant === "onLight") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
          <Star className="w-3 h-3" />
          {cat}
        </Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className="flex items-center gap-1 border border-white/30 bg-white/20 text-white"
      >
        <Star className="w-3 h-3" />
        {cat}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (announcements.length === 0 || isDismissed) {
    return null;
  }

  const currentAnnouncement = announcements[currentIndex];
  const dragRatio = Math.min(Math.abs(dragDeltaX) / 160, 1);
  const visualOffset = dragDeltaX * 0.18 + swipeFxOffset;
  const visualScale = 1 - dragRatio * 0.03;
  const visualOpacity = 1 - dragRatio * 0.2;
  const edgeGlowSide = dragDeltaX > 0 ? "left" : "right";

  return (
    <>
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-lg",
        getAnnouncementStyleClass(currentAnnouncement.style_preset),
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      >
        <CardContent
          className="p-4 relative"
          style={{
            transform: `translateX(${visualOffset}px) scale(${visualScale})`,
            opacity: visualOpacity,
            transition: isTouching
              ? "none"
              : "transform 220ms ease, opacity 220ms ease",
          }}
        >
          {announcements.length > 1 && dragRatio > 0.05 && (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-0 bottom-0 w-12",
                edgeGlowSide === "left" ? "left-0" : "right-0"
              )}
              style={{
                background:
                  edgeGlowSide === "left"
                    ? "linear-gradient(to right, rgba(255,255,255,0.32), rgba(255,255,255,0))"
                    : "linear-gradient(to left, rgba(255,255,255,0.32), rgba(255,255,255,0))",
                opacity: dragRatio,
              }}
            />
          )}
          <div className="flex items-center justify-between text-white">
            <div className="flex-1 cursor-pointer pr-10" onClick={() => handleAnnouncementClick(currentAnnouncement)}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {getCategoryBadge(currentAnnouncement)}
                <span className="text-xs opacity-80">
                  {currentAnnouncement.display_date
                    ? format(
                        new Date(currentAnnouncement.display_date + "T12:00:00"),
                        "yyyy/MM/dd",
                        { locale: zhTW }
                      )
                    : format(new Date(currentAnnouncement.created_at), "MM/dd", { locale: zhTW })}
                </span>
              </div>
              <h3 className="font-bold text-lg mb-1 line-clamp-1">
                {currentAnnouncement.title}
              </h3>
              {currentAnnouncement.summary && (
                <p className="text-sm opacity-90 line-clamp-2">
                  {currentAnnouncement.summary}
                </p>
              )}
            </div>
          </div>

          {showCloseButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="absolute right-2 top-2 text-white hover:bg-white/20 h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          {/* Progress dots */}
          {announcements.length > 1 && (
            <div className="flex justify-center gap-1 mt-3">
              {announcements.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentIndex 
                      ? "bg-white" 
                      : "bg-white/50 hover:bg-white/75"
                  )}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Announcement Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {selectedAnnouncement && getCategoryBadge(selectedAnnouncement, "onLight")}
              <span className="break-words">{selectedAnnouncement?.title}</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedAnnouncement && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                {getText('announcement.dialog.publishedAt', '發布時間：')}
                {format(new Date(selectedAnnouncement.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })}
                </div>
              </div>

              {selectedAnnouncement.image_url && (
                <div className="w-full">
                  <img
                    src={selectedAnnouncement.image_url}
                    alt={selectedAnnouncement.title}
                    className="w-full h-48 object-cover rounded-lg"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap">
                  {selectedAnnouncement.content}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setIsDialogOpen(false)}>
                  {getText('announcement.dialog.close', '關閉')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
