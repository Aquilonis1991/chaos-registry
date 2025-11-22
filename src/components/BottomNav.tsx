import { Link, useLocation } from "react-router-dom";
import { Home, Wallet, Gift, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

export const BottomNav = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  const navItems = [
    { name: getText('bottomNav.home', '首頁'), icon: Home, path: "/" },
    { name: getText('bottomNav.recharge', '儲值'), icon: Wallet, path: "/recharge" },
    { name: getText('bottomNav.mission', '任務'), icon: Gift, path: "/mission" },
    { name: getText('bottomNav.profile', '個人'), icon: User, path: "/profile" },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
      <div className="max-w-screen-xl mx-auto px-2">
        <div className="flex justify-around items-end h-16 relative">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-lg transition-all relative py-2 px-3",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn(
                  "w-6 h-6 transition-all",
                  isActive && "scale-110"
                )} />
                {item.name && (
                  <span className={cn(
                    "font-medium transition-all",
                    "text-xs"
                  )}>{item.name}</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
