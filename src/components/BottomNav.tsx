import { Link, useLocation } from "react-router-dom";
import { Home, Wallet, PlusCircle, Gift, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "首頁", icon: Home, path: "/", size: "normal" },
  { name: "儲值", icon: Wallet, path: "/recharge", size: "normal" },
  { name: "", icon: PlusCircle, path: "/create", size: "large" },
  { name: "任務", icon: Gift, path: "/mission", size: "normal" },
  { name: "個人", icon: User, path: "/profile", size: "normal" },
] as const;

export const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
      <div className="max-w-screen-xl mx-auto px-2">
        <div className="flex justify-around items-end h-16 relative">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isLarge = item.size === "large";
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-lg transition-all relative",
                  isLarge ? "py-0 px-2 -mb-3" : "py-2 px-3",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isLarge ? (
                  <div className={cn(
                    "bg-gradient-primary shadow-glow rounded-full p-5 transition-transform scale-110 -mt-8",
                    isActive && "scale-125"
                  )}>
                    <Icon className="w-9 h-9 text-primary-foreground" />
                  </div>
                ) : (
                  <Icon className={cn(
                    "w-6 h-6 transition-all",
                    isActive && "scale-110"
                  )} />
                )}
                {item.name && (
                  <span className={cn(
                    "font-medium transition-all",
                    isLarge ? "text-xs mt-1" : "text-xs"
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
