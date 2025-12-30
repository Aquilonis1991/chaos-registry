import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import LegalContentRenderer from "@/components/LegalContentRenderer";

const PrivacyPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { loading: configLoading, getConfig } = useSystemConfigCache();

  const dynamicContent = getConfig<string>('legal_privacy_content', '');
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
                {getText('privacyPage.header.title', '隱私權政策')}
              </h1>
              <p className="text-xs text-primary-foreground/80">
                {getText('privacyPage.header.subtitle', 'Privacy Policy')}
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
              <h2 className="text-2xl font-bold text-foreground mb-2">🔒《不理性登記處 隱私權政策》</h2>
              <p className="text-muted-foreground">
                {hasCustomContent ? getText('privacyPage.header.subtitle', 'Privacy Policy') : '版本日期：2025 年 10 月'}
              </p>
            </div>

            {hasCustomContent ? (
              <LegalContentRenderer content={dynamicContent} />
            ) : (
              <DefaultPrivacySections />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const DefaultPrivacySections = () => (
  <>
    <p className="text-foreground">
      感謝您使用《不理性登記處》（以下簡稱「本服務」或「本 App」）。本隱私權政策說明本公司（OOO 有限公司）如何收集、使用、儲存及保護您的個人資料。
    </p>
    <p className="text-foreground font-semibold">
      當您使用本服務時，即表示您已閱讀並同意本政策的所有內容。
    </p>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">一、資料收集範圍</h3>
      <p className="text-foreground mb-3">為提供完整服務體驗，本 App 可能收集以下資訊：</p>

      <h4 className="text-lg font-semibold text-foreground mb-2">1. 帳號資訊</h4>
      <ul className="list-disc list-inside space-y-2 text-foreground mb-4">
        <li>第三方登入資訊（Google、Apple ID 等授權資料）</li>
        <li>使用者暱稱、電子郵件（如有提供）</li>
        <li>裝置識別碼（UUID）</li>
      </ul>

      <h4 className="text-lg font-semibold text-foreground mb-2">2. 使用行為資料</h4>
      <ul className="list-disc list-inside space-y-2 text-foreground mb-4">
        <li>投票紀錄、建立主題內容</li>
        <li>代幣消耗與儲值記錄</li>
        <li>瀏覽紀錄、點擊行為、停留時間</li>
        <li>裝置資訊（作業系統、App 版本、語言設定）</li>
      </ul>

      <h4 className="text-lg font-semibold text-foreground mb-2">3. 其他資訊</h4>
      <ul className="list-disc list-inside space-y-2 text-foreground">
        <li>IP 位址、地理位置（僅用於防詐騙與優化服務）</li>
        <li>廣告互動資料（透過 Google AdMob 等第三方服務收集）</li>
      </ul>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">二、資料使用目的</h3>
      <p className="text-foreground mb-3">本公司收集資料的目的包括：</p>
      <ol className="list-decimal list-inside space-y-2 text-foreground">
        <li><strong>提供與維護服務</strong>：確保帳號登入、投票功能、代幣系統正常運作。</li>
        <li><strong>個人化體驗</strong>：根據使用習慣推薦熱門投票主題。</li>
        <li><strong>統計與分析</strong>：瞭解使用者行為，優化產品功能與介面。</li>
        <li><strong>安全與防詐</strong>：偵測異常行為、防止惡意操作或多帳號灌票。</li>
        <li><strong>廣告投放</strong>：透過第三方廣告平台（如 Google AdMob）顯示相關廣告。</li>
        <li><strong>客服與通知</strong>：處理用戶反饋、發送系統更新或活動訊息。</li>
      </ol>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">三、資料分享與揭露</h3>
      <p className="text-foreground mb-3">本公司不會將您的個人資料出售或出租給第三方。但在以下情況下，可能與第三方分享資料：</p>

      <h4 className="text-lg font-semibold text-foreground mb-2">1. 服務供應商</h4>
      <ul className="list-disc list-inside space-y-2 text-foreground mb-4">
        <li>雲端儲存與資料庫服務（如 Supabase、AWS）</li>
        <li>支付處理商（Google Play、Apple App Store）</li>
        <li>廣告平台（Google AdMob）</li>
        <li>分析工具（Google Analytics、Firebase）</li>
      </ul>

      <h4 className="text-lg font-semibold text-foreground mb-2">2. 法律要求</h4>
      <p className="text-foreground mb-4">
        當法律規定、法院命令或執法單位要求時，本公司有義務提供相關資料。
      </p>

      <h4 className="text-lg font-semibold text-foreground mb-2">3. 企業併購</h4>
      <p className="text-foreground">
        若本公司發生合併、收購或資產轉讓，您的資料可能隨之轉移，但仍受本政策約束。
      </p>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">四、資料保存與安全</h3>
      <ol className="list-decimal list-inside space-y-2 text-foreground">
        <li><strong>保存期限</strong>：資料將保存至您停止使用本服務或刪除帳號後的合理期限內，除非法律另有規定。</li>
        <li><strong>安全措施</strong>：本公司採用業界標準的加密技術、存取控制與防火牆保護資料安全。</li>
        <li><strong>免責聲明</strong>：儘管已採取安全措施，仍無法完全保證資料不會因網路攻擊或不可抗力因素而外洩。</li>
      </ol>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">五、您的權利</h3>
      <p className="text-foreground mb-3">依照相關法規，您擁有以下權利：</p>
      <ol className="list-decimal list-inside space-y-2 text-foreground">
        <li><strong>查詢與更正</strong>：您可透過 App 設定查看或修改個人資料（如暱稱、頭像）。</li>
        <li><strong>刪除與撤回</strong>：您可要求刪除帳號，資料將於合理期限內移除。</li>
        <li><strong>停止行銷訊息</strong>：您可隨時關閉推播通知或取消訂閱電子報。</li>
        <li><strong>資料可攜性</strong>：您可要求匯出您的個人資料（需透過客服申請）。</li>
      </ol>
      <p className="text-foreground mt-3">
        如欲行使上述權利，請透過 <strong>support@votechaos.com</strong> 聯繫我們。
      </p>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">六、Cookie 與追蹤技術</h3>
      <p className="text-foreground mb-3">本 App 可能使用以下技術：</p>
      <ul className="list-disc list-inside space-y-2 text-foreground">
        <li><strong>Cookie</strong>：記錄登入狀態與偏好設定。</li>
        <li><strong>分析工具</strong>：Google Analytics、Firebase 用於流量統計與錯誤追蹤。</li>
        <li><strong>廣告識別碼</strong>：Google AdMob 使用廣告 ID 投放個人化廣告（您可在裝置設定中重設或關閉）。</li>
      </ul>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">七、兒童隱私</h3>
      <p className="text-foreground">
        本服務不針對 13 歲以下兒童設計。若我們發現未滿 13 歲的使用者資料，將立即刪除。家長或監護人如發現未成年人使用本服務，請聯繫我們處理。
      </p>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">八、第三方服務與連結</h3>
      <p className="text-foreground">
        本 App 可能包含第三方網站或服務的連結（如社群平台分享）。這些外部網站的隱私政策不在本公司控制範圍內，建議您在使用前詳閱其條款。
      </p>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">九、政策更新</h3>
      <ol className="list-decimal list-inside space-y-2 text-foreground">
        <li>本公司保留隨時修改本政策的權利。</li>
        <li>重大變更將透過 App 內通知或電子郵件告知。</li>
        <li>修訂後的政策將於發佈後生效，繼續使用本服務視為您已同意新政策。</li>
      </ol>
    </section>

    <section>
      <h3 className="text-xl font-bold text-foreground mb-3">十、聯絡我們</h3>
      <p className="text-foreground">
        若對本隱私權政策有任何疑問或需要協助，請聯繫：<br />
        📧 Email: <strong>support@votechaos.com</strong>
        <br />
        📍 公司地址：台灣台北市
        <br />
        🕒 客服時間：週一至週五 10:00-18:00
      </p>
    </section>

    <div className="border-t pt-6 mt-8 text-center">
      <p className="text-muted-foreground text-sm">
        最後更新日期：2025 年 10 月
        <br />
        感謝您信任《不理性登記處》，我們致力於保護您的隱私安全！🔒
      </p>
    </div>
  </>
);

export default PrivacyPage;
