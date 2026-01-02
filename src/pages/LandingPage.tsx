import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Vote, Users, Coins, Shield, ArrowRight, Check } from "lucide-react";
import { Logo } from "@/components/Logo";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-primary text-primary-foreground py-16 px-4">
        <div className="max-w-screen-xl mx-auto text-center">
          <div className="mb-6">
            <Logo className="mx-auto" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            不理性登記處
          </h1>
          <p className="text-xl md:text-2xl mb-2 opacity-90">
            以虛構、趣味話題為核心的娛樂性投票平台
          </p>
          <p className="text-lg mb-8 opacity-80 max-w-2xl mx-auto">
            提供輕鬆、有趣的投票體驗，讓使用者可以瀏覽主題、參與投票、發起話題，並使用代幣提高主題曝光度
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                立即開始
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/about">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
                了解更多
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-screen-xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">核心功能</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <Vote className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">投票系統</h3>
                <p className="text-muted-foreground">
                  參與各種有趣的投票主題，表達您的意見和想法
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">主題創建</h3>
                <p className="text-muted-foreground">
                  發起您感興趣的投票話題，與其他用戶互動
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Coins className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">代幣系統</h3>
                <p className="text-muted-foreground">
                  使用代幣參與投票或提高主題曝光度
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">內容治理</h3>
                <p className="text-muted-foreground">
                  完善的舉報機制，確保平台內容健康安全
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-screen-xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4">關於 不理性登記處</h2>
              <p className="text-lg text-muted-foreground mb-4">
                不理性登記處 是一款以虛構、趣味話題為核心的娛樂性投票平台。
              </p>
              <p className="text-muted-foreground mb-4">
                我們致力於提供一個輕鬆、有趣的投票體驗，讓使用者可以瀏覽主題、參與投票、發起話題，並使用代幣提高主題曝光度。
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary" />
                  <span>完善的內容治理機制</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary" />
                  <span>禁止真實政治人物與仇恨言論</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary" />
                  <span>僅供娛樂用途</span>
                </div>
              </div>
              <div className="mt-6">
                <Link to="/about">
                  <Button>
                    了解更多關於我們
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="bg-gradient-primary/10 p-8 rounded-lg">
              <h3 className="text-2xl font-bold mb-4">服務內容</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>投票平台服務：提供用戶瀏覽、參與和創建投票主題的平台</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>代幣系統：用戶可以使用代幣參與投票或提高主題曝光度</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>內容管理：提供內容審核和舉報機制，確保平台內容品質</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>用戶服務：提供用戶支援、問題回報和建議反饋服務</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 px-4">
        <div className="max-w-screen-xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">聯絡我們</h2>
          <p className="text-lg text-muted-foreground mb-8">
            如有任何問題或建議，歡迎與我們聯繫
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact">
              <Button size="lg">
                聯絡我們
              </Button>
            </Link>
            <Link to="/terms">
              <Button size="lg" variant="outline">
                服務條款
              </Button>
            </Link>
            <Link to="/privacy">
              <Button size="lg" variant="outline">
                隱私權政策
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted py-8 px-4">
        <div className="max-w-screen-xl mx-auto text-center text-sm text-muted-foreground">
          <p className="mb-2">
            © 2025 不理性登記處. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/about" className="hover:text-primary">關於我們</Link>
            <Link to="/terms" className="hover:text-primary">服務條款</Link>
            <Link to="/privacy" className="hover:text-primary">隱私權政策</Link>
            <Link to="/contact" className="hover:text-primary">聯絡我們</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;



