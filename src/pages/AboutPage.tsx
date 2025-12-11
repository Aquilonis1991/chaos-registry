import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Mail, Globe, Users, Vote, Coins, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

const AboutPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">
                {getText('aboutPage.header.title', '關於我們')}
              </h1>
              <p className="text-xs text-primary-foreground/80">
                {getText('aboutPage.header.subtitle', 'About Us')}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="p-6 space-y-8">
            {/* 商家介紹 */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-3">關於 ChaosRegistry</h2>
              <p className="text-lg text-muted-foreground">
                {getText('aboutPage.company.tagline', '以虛構、趣味話題為核心的娛樂性投票平台')}
              </p>
            </div>

            {/* 商家描述 */}
            <section>
              <h3 className="text-2xl font-bold text-foreground mb-4">📱 關於我們</h3>
              <div className="space-y-4 text-foreground">
                <p>
                  <strong>ChaosRegistry</strong>（中文名稱：全民亂投）是一款以虛構、趣味話題為核心的娛樂性投票平台。
                </p>
                <p>
                  我們致力於提供一個輕鬆、有趣的投票體驗，讓使用者可以：
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>瀏覽各種有趣的投票主題</li>
                  <li>使用代幣參與投票，表達自己的意見</li>
                  <li>發起自己感興趣的投票話題</li>
                  <li>使用代幣提高主題曝光度，讓更多人看到</li>
                </ul>
                <p className="mt-4">
                  <strong>重要聲明</strong>：本平台具備內容治理與舉報機制，禁止真實政治人物、仇恨言論或敏感政治內容。本服務僅供娛樂用途，不反映任何真實政治行為或公共政策。
                </p>
              </div>
            </section>

            {/* 核心功能 */}
            <section>
              <h3 className="text-2xl font-bold text-foreground mb-4">✨ 核心功能</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Vote className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">投票系統</h4>
                    <p className="text-sm text-muted-foreground">
                      參與各種有趣的投票主題，表達您的意見和想法
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Users className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">主題創建</h4>
                    <p className="text-sm text-muted-foreground">
                      發起您感興趣的投票話題，與其他用戶互動
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Coins className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">代幣系統</h4>
                    <p className="text-sm text-muted-foreground">
                      使用代幣參與投票或提高主題曝光度
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">內容治理</h4>
                    <p className="text-sm text-muted-foreground">
                      完善的舉報機制，確保平台內容健康安全
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 服務內容 */}
            <section>
              <h3 className="text-2xl font-bold text-foreground mb-4">🎯 服務內容</h3>
              <div className="space-y-3 text-foreground">
                <p>
                  ChaosRegistry 提供以下服務：
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li><strong>投票平台服務</strong>：提供用戶瀏覽、參與和創建投票主題的平台</li>
                  <li><strong>代幣系統</strong>：用戶可以使用代幣參與投票或提高主題曝光度</li>
                  <li><strong>內容管理</strong>：提供內容審核和舉報機制，確保平台內容品質</li>
                  <li><strong>用戶服務</strong>：提供用戶支援、問題回報和建議反饋服務</li>
                </ol>
              </div>
            </section>

            {/* 商家資訊 */}
            <section>
              <h3 className="text-2xl font-bold text-foreground mb-4">🏢 商家資訊</h3>
              <div className="space-y-4 text-foreground">
                <div>
                  <p className="font-semibold text-lg mb-2">商家名稱</p>
                  <p className="text-muted-foreground">ChaosRegistry（全民亂投）</p>
                </div>
                
                <div>
                  <p className="font-semibold text-lg mb-2">服務類型</p>
                  <p className="text-muted-foreground">應用程式開發 / 軟體服務</p>
                </div>

                <div>
                  <p className="font-semibold text-lg mb-2">服務描述</p>
                  <p className="text-muted-foreground">
                    ChaosRegistry 是一款以虛構、趣味話題為核心的娛樂性投票平台。
                    使用者可瀏覽主題、以代幣投票、發起投票，或使用代幣提高主題曝光度。
                    平台具備內容治理與舉報機制，禁止真實政治人物、仇恨言論或敏感政治內容。
                    本服務僅供娛樂用途，不反映任何真實政治行為或公共政策。
                  </p>
                </div>
              </div>
            </section>

            {/* 聯絡資訊 */}
            <section>
              <h3 className="text-2xl font-bold text-foreground mb-4">📞 聯絡資訊</h3>
              <div className="space-y-3 text-foreground">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-semibold">電子郵件</p>
                    <p className="text-sm text-muted-foreground">
                      請透過 <Link to="/contact" className="text-primary hover:underline">聯絡我們</Link> 頁面與我們聯繫
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-semibold">官方網站</p>
                    <p className="text-sm text-muted-foreground">
                      <a 
                        href="https://chaos-registry.vercel.app" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        https://chaos-registry.vercel.app
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 相關連結 */}
            <section>
              <h3 className="text-2xl font-bold text-foreground mb-4">🔗 相關連結</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link 
                  to="/privacy" 
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">隱私權政策</span>
                  </div>
                </Link>
                <Link 
                  to="/terms" 
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">服務條款</span>
                  </div>
                </Link>
                <Link 
                  to="/contact" 
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">聯絡我們</span>
                  </div>
                </Link>
              </div>
            </section>

            {/* 版權資訊 */}
            <div className="border-t pt-6 mt-8 text-center">
              <p className="text-muted-foreground text-sm">
                © 2025 ChaosRegistry. All rights reserved.
                <br />
                {getText('aboutPage.footer.tagline', '讓投票變得更有趣！')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AboutPage;

