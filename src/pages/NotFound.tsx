import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">
          {getText('notFound.message', 'Oops! Page not found')}
        </p>
        <Button asChild variant="outline">
          <a href="/" className="inline-flex items-center gap-2">
            <Home className="w-4 h-4" />
            {getText('notFound.button.home', 'Return to Home')}
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
