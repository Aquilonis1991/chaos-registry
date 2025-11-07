import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Calendar, 
  Clock, 
  Star,
  ExternalLink,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface Announcement {
  id: string;
  title: string;
  content: string;
  summary?: string;
  image_url?: string;
  priority: number;
  click_count: number;
  created_at: string;
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase.rpc('get_active_announcements', {
        limit_count: 3
      });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

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
    setIsDismissed(true);
    onClose?.();
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 90) {
      return "bg-gradient-to-r from-red-500 to-pink-500";
    } else if (priority >= 70) {
      return "bg-gradient-to-r from-blue-500 to-purple-500";
    } else if (priority >= 50) {
      return "bg-gradient-to-r from-green-500 to-teal-500";
    } else {
      return "bg-gradient-to-r from-gray-500 to-slate-500";
    }
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 90) {
      return <Badge variant="destructive" className="flex items-center gap-1"><Star className="w-3 h-3" />重要</Badge>;
    } else if (priority >= 70) {
      return <Badge variant="default" className="flex items-center gap-1"><Star className="w-3 h-3" />一般</Badge>;
    } else {
      return <Badge variant="outline" className="flex items-center gap-1"><Star className="w-3 h-3" />通知</Badge>;
    }
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

  return (
    <>
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-lg",
        getPriorityColor(currentAnnouncement.priority),
        className
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex-1 cursor-pointer" onClick={() => handleAnnouncementClick(currentAnnouncement)}>
              <div className="flex items-center gap-2 mb-2">
                {getPriorityBadge(currentAnnouncement.priority)}
                <span className="text-xs opacity-80">
                  {format(new Date(currentAnnouncement.created_at), 'MM/dd', { locale: zhTW })}
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

            <div className="flex items-center gap-2 ml-4">
              {announcements.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrev}
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs opacity-80">
                    {currentIndex + 1}/{announcements.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNext}
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

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
            <DialogTitle className="flex items-center gap-2">
              {selectedAnnouncement && getPriorityBadge(selectedAnnouncement.priority)}
              {selectedAnnouncement?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedAnnouncement && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  發布時間：{format(new Date(selectedAnnouncement.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  點擊數：{selectedAnnouncement.click_count}
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
                  關閉
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
