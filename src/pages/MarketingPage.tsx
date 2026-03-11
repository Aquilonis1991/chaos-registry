import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

const HOMEPAGE_URL = "https://chaos-registry.vercel.app";

const MarketingPage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-6">
          <h1 className="text-xl font-bold text-foreground">行銷／官網</h1>
          <p className="text-muted-foreground text-sm">前往不理性登記處首頁</p>
          <Button asChild className="w-full">
            <a href={HOMEPAGE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
              前往首頁
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingPage;
