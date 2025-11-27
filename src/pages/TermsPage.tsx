import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import LegalContentRenderer from "@/components/LegalContentRenderer";

const TermsPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { loading: configLoading, getConfig } = useSystemConfigCache();

  const dynamicContent = getConfig<string>('legal_terms_content', '');
  const hasCustomContent = !configLoading && typeof dynamicContent === 'string' && dynamicContent.trim().length > 0;

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
                {getText('termsPage.header.title', '使用者條款')}
              </h1>
              <p className="text-xs text-primary-foreground/80">
                {getText('termsPage.header.subtitle', 'Terms of Service')}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="p-6 space-y-6 prose prose-sm max-w-none">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">📜《全民亂投 App 使用者條款》</h2>
              <p className="text-muted-foreground">
                {hasCustomContent ? getText('termsPage.header.subtitle', 'Terms of Service') : '版本日期：2025 年 10 月'}
              </p>
            </div>

            {hasCustomContent ? (
              <LegalContentRenderer content={dynamicContent} />
            ) : (
              <DefaultTermsSections />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const DefaultTermsSections = () => (
  <>
    <p className="text-foreground">
      感謝您使用《全民亂投》（以下簡稱「本服務」），本應用程式由 OOO 有限公司（以下簡稱「本公司」）所營運。
    </p>
    <p className="text-foreground">
      在使用本服務前，請您仔細閱讀以下條款。
    </p>
    <p className="text-foreground font-semibold">
      當您安裝、登入或使用本 App，即表示您已同意本條款的全部內容。
    </p>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">一、服務宗旨</h3>
      <p className="text-foreground">
        《全民亂投》是一款以「搞笑、反串、娛樂」為主軸的全民投票平台。所有投票主題、內容與結果皆屬虛構創作，僅供使用者娛樂、討論與社群互動之用，不代表真實立場、政治意圖或任何事實陳述。
      </p>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">二、帳號註冊與登入</h3>
      <ol className="list-decimal list-inside space-y-2 text-foreground">
        <li>您可使用第三方帳號（Google、Apple 等）登入，或選擇匿名登入。</li>
        <li>匿名登入的資料僅綁定於您的裝置，如刪除 App 或更換手機，資料將無法復原。</li>
        <li>若您使用第三方帳號登入，即表示同意該服務提供者的相關條款與隱私政策。</li>
        <li>您有義務提供真實、準確的基本資料（如暱稱），並不得冒用他人身分或使用違反社會善良風俗之名稱。</li>
        <li>若有違反本條款或濫用行為，本公司得限制、暫停或終止您的使用資格。</li>
      </ol>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">三、代幣制度</h3>
      <ol className="list-decimal list-inside space-y-2 text-foreground">
        <li>本服務提供之「代幣」為 App 內專用虛擬貨幣，僅可用於投票、建立主題、購買曝光方案等功能。</li>
        <li>代幣無法兌換現金、轉讓或提領，亦不具任何投資性質。</li>
        <li>代幣可透過以下方式取得：
          <ul className="list-disc list-inside ml-6 mt-2">
            <li>內購儲值（實際金流經由 Google / Apple 官方管道）</li>
            <li>完成任務（登入、觀看廣告等）</li>
          </ul>
        </li>
        <li>代幣一經使用、儲值或消耗，概不退還。</li>
        <li>若因系統錯誤導致代幣異常，本公司得於查證後進行調整。</li>
      </ol>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">四、使用規範</h3>
      <p className="text-foreground mb-3">使用本服務時，請遵守以下原則：</p>
      
      <h4 className="text-lg font-semibold text-foreground mb-2">1. 禁止行為</h4>
      <ul className="list-disc list-inside space-y-2 text-foreground mb-4">
        <li>上傳或發佈違反法律、公序良俗、仇恨或歧視言論之內容。</li>
        <li>發表涉及真實人物、政黨、宗教、性別或暴力之攻擊性言論。</li>
        <li>散布詐騙、色情、惡意連結或廣告。</li>
        <li>操作自動化程式或多帳號灌票、濫用投票機制。</li>
      </ul>

      <h4 className="text-lg font-semibold text-foreground mb-2">2. 舉報與審查</h4>
      <ul className="list-disc list-inside space-y-2 text-foreground mb-4">
        <li>用戶可透過檢舉功能回報可疑或違規內容。</li>
        <li>本公司得依內部審查機制隱藏、刪除、下架或封鎖違規帳號。</li>
      </ul>

      <h4 className="text-lg font-semibold text-foreground mb-2">3. 內容刪除</h4>
      <ul className="list-disc list-inside space-y-2 text-foreground">
        <li>若您刪除帳號或被停權，所建立的主題與投票紀錄將無法復原。</li>
        <li>因違規被刪除之內容，不得要求補償或回復。</li>
      </ul>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">五、使用者內容授權</h3>
      <ul className="list-disc list-inside space-y-2 text-foreground">
        <li>您在本服務中所建立或上傳的內容（如主題、投票、文字等），視為您授權本公司得於平台上使用、展示、重製、修改及宣傳之用途。</li>
        <li>本公司不主張內容所有權，但得為維護平台品質進行調整或下架。</li>
      </ul>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">六、服務變更與中止</h3>
      <ol className="list-decimal list-inside space-y-2 text-foreground">
        <li>本公司得視情況調整、更新或停止本服務之全部或部分功能，並不保證服務於任何時間皆可正常使用。</li>
        <li>若因系統維護、升級、第三方服務中斷或不可抗力因素導致暫時停止，本公司將儘可能提前公告或於恢復後通知使用者。</li>
        <li>本公司保留隨時修改或終止服務之權利，且對因此產生之任何損害不負賠償責任。</li>
      </ol>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">七、個資與隱私</h3>
      <ol className="list-decimal list-inside space-y-2 text-foreground">
        <li>本公司將依據《全民亂投隱私權政策》保護使用者資料。</li>
        <li>主要收集項目包含：登入識別資訊（UUID、Email）、使用紀錄、代幣消耗與行為統計。</li>
        <li>未經您的同意，本公司不會將個人資料提供給第三方，除非依法律規定或執法單位要求。</li>
      </ol>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">八、免責聲明</h3>
      <ol className="list-decimal list-inside space-y-2 text-foreground">
        <li>所有投票結果、文字內容與統計數據皆為使用者產出，本公司不保證其真實性、正確性或完整性。</li>
        <li>使用者於平台上所發表之意見、圖片或資訊，僅代表個人觀點，不代表本公司立場。</li>
        <li>因使用本服務所生之任何糾紛或損害，本公司僅在法律允許範圍內負有限責任。</li>
      </ol>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">九、準據法與管轄</h3>
      <p className="text-foreground">
        本條款之解釋與適用，以 中華民國法律 為準據法。如發生爭議，雙方同意以 台灣臺北地方法院 為第一審管轄法院。
      </p>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">十、條款修訂</h3>
      <ol className="list-decimal list-inside space-y-2 text-foreground">
        <li>本公司保留隨時修改、增刪本條款之權利，修訂後條款將於 App 內公告或透過通知告知使用者。</li>
        <li>若您於條款修訂後繼續使用本服務，視為您已同意修訂後條款。</li>
      </ol>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">十一、聯絡我們</h3>
      <p className="text-foreground">
        若對本條款有任何疑問，請透過以下方式聯繫：<br />
        📧 Email: support@votechaos.com<br />
        📍 公司地址：台灣台北市
      </p>
    </section>

    <div className="border-t pt-6 mt-8 text-center">
      <p className="text-muted-foreground text-sm">
        最後更新日期：2025 年 10 月
        <br />
        感謝您的使用，祝您玩得開心！🎉
      </p>
    </div>
  </>
);

export default TermsPage;
