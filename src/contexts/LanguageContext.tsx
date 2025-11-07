import { createContext, useContext, useState, ReactNode } from "react";

export type BaseLanguage = "zh" | "en" | "ja";
export type Language = BaseLanguage | `${BaseLanguage}-${string}`;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<BaseLanguage, Record<string, string>> = {
  zh: {
    // Header
    "app.name": "VoteChaos",
    "app.slogan": "投票混亂製造機",
    "tokens": "代幣",
    
    // Tabs
    "tab.hot": "🔥 熱門",
    "tab.latest": "⚡ 最新",
    "tab.joined": "✅ 參與過",
    
    // Profile
    "profile.votes": "投票次數",
    "profile.topics": "發起主題",
    "profile.history": "歷史紀錄",
    "profile.voteHistory": "投票紀錄",
    "profile.topicHistory": "主題發起紀錄",
    "profile.tokenHistory": "代幣使用紀錄",
    "profile.settings": "設定",
    "profile.language": "語言與地區",
    "profile.notifications": "通知設定",
    "profile.terms": "使用者條款",
    "profile.privacy": "隱私權政策",
    "profile.contact": "連絡我們",
    "profile.nameUpdated": "名稱已更新",
    "profile.avatarUpdated": "頭像已更新",
    
    // Empty states
    "empty.noVotes": "還沒有參與過的投票",
    "empty.noTopics": "還沒有發起過的主題",
    "empty.noTokenHistory": "還沒有使用紀錄",
    "empty.startVoting": "開始投票",
    
    // Missions
    "mission.title": "每日任務",
    "mission.login7days": "7天登入",
    "mission.voteEnthusiast": "投票愛好者",
    "mission.topicCreator": "話題創造者",
    "mission.adWatcher": "廣告觀看者",
  },
  en: {
    // Header
    "app.name": "VoteChaos",
    "app.slogan": "Chaos Voting Machine",
    "tokens": "Tokens",
    
    // Tabs
    "tab.hot": "🔥 Hot",
    "tab.latest": "⚡ Latest",
    "tab.joined": "✅ Joined",
    
    // Profile
    "profile.votes": "Total Votes",
    "profile.topics": "Topics Created",
    "profile.history": "History",
    "profile.voteHistory": "Vote History",
    "profile.topicHistory": "Topic History",
    "profile.tokenHistory": "Token Usage History",
    "profile.settings": "Settings",
    "profile.language": "Language & Region",
    "profile.notifications": "Notifications",
    "profile.terms": "Terms of Service",
    "profile.privacy": "Privacy Policy",
    "profile.contact": "Contact Us",
    "profile.nameUpdated": "Name updated",
    "profile.avatarUpdated": "Avatar updated",
    
    // Empty states
    "empty.noVotes": "No votes yet",
    "empty.noTopics": "No topics created yet",
    "empty.noTokenHistory": "No usage history",
    "empty.startVoting": "Start Voting",
    
    // Missions
    "mission.title": "Daily Missions",
    "mission.login7days": "7-Day Login",
    "mission.voteEnthusiast": "Vote Enthusiast",
    "mission.topicCreator": "Topic Creator",
    "mission.adWatcher": "Ad Watcher",
  },
  ja: {
    // Header
    "app.name": "VoteChaos",
    "app.slogan": "投票カオスメーカー",
    "tokens": "トークン",
    
    // Tabs
    "tab.hot": "🔥 人気",
    "tab.latest": "⚡ 最新",
    "tab.joined": "✅ 参加済み",
    
    // Profile
    "profile.votes": "投票回数",
    "profile.topics": "作成したトピック",
    "profile.history": "履歴",
    "profile.voteHistory": "投票履歴",
    "profile.topicHistory": "トピック作成履歴",
    "profile.tokenHistory": "トークン使用履歴",
    "profile.settings": "設定",
    "profile.language": "言語と地域",
    "profile.notifications": "通知設定",
    "profile.terms": "利用規約",
    "profile.privacy": "プライバシーポリシー",
    "profile.contact": "お問い合わせ",
    "profile.nameUpdated": "名前を更新しました",
    "profile.avatarUpdated": "アバターを更新しました",
    
    // Empty states
    "empty.noVotes": "まだ投票がありません",
    "empty.noTopics": "まだトピックを作成していません",
    "empty.noTokenHistory": "使用履歴がありません",
    "empty.startVoting": "投票を始める",
    
    // Missions
    "mission.title": "デイリーミッション",
    "mission.login7days": "7日間ログイン",
    "mission.voteEnthusiast": "投票愛好家",
    "mission.topicCreator": "トピッククリエイター",
    "mission.adWatcher": "広告視聴者",
  },
};

export const resolveBaseLanguage = (lang: Language): BaseLanguage => {
  const base = lang.split("-")[0] as BaseLanguage;
  return translations[base] ? base : "zh";
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("zh");

  const t = (key: string): string => {
    const base = resolveBaseLanguage(language);
    return translations[base][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
