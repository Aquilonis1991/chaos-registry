import { createContext, useContext, useState, ReactNode } from "react";

export type BaseLanguage = "zh" | "en" | "ja";
export type Language = BaseLanguage | `${BaseLanguage}-${string}`;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const defaultLanguageContext: LanguageContextType = {
  language: "zh",
  setLanguage: () => {
    if (typeof window !== 'undefined') {
      console.warn('[LanguageContext] LanguageProvider missing, defaulting to zh');
    }
  },
  t: (key: string) => key,
};

const translations: Record<BaseLanguage, Record<string, string>> = {
  zh: {
    // Header
    "app.name": "ChaosRegistry",
    "app.slogan": "不理性登記處",
    "tokens": "失序值",

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
    "profile.tokenHistory": "失序值使用紀錄",
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

    // Vote Detail
    "vote.detail.section.ended": "投票已結束",

    // Token history
    "tokenHistory.type.extendTopicDuration": "延長投票時間",
    "tokenHistory.type.addTopicOption": "新增投票選項",
    "tokenHistory.type.deposit": "儲值",
    "tokenHistory.description.extendTopicDuration": "延長投票時間",
    "tokenHistory.description.addTopicOption": "新增投票選項",
    "tokenHistory.description.deposit": "儲值",
  },
  en: {
    // Header
    "app.name": "ChaosRegistry",
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

    // Vote Detail
    "vote.detail.section.ended": "Voting ended",

    // Token history
    "tokenHistory.type.extendTopicDuration": "Extend voting time",
    "tokenHistory.type.addTopicOption": "Add vote option",
    "tokenHistory.type.deposit": "Deposit",
    "tokenHistory.description.extendTopicDuration": "Extend voting time",
    "tokenHistory.description.addTopicOption": "Add vote option",
    "tokenHistory.description.deposit": "Deposit",
  },
  ja: {
    // Header
    "app.name": "ChaosRegistry",
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

    // Vote Detail
    "vote.detail.section.ended": "投票は終了しました",

    // Token history
    "tokenHistory.type.extendTopicDuration": "投票時間を延長",
    "tokenHistory.type.addTopicOption": "投票の選択肢を追加",
    "tokenHistory.type.deposit": "チャージ",
    "tokenHistory.description.extendTopicDuration": "投票時間を延長",
    "tokenHistory.description.addTopicOption": "投票の選択肢を追加",
    "tokenHistory.description.deposit": "チャージ",
  },
};

export const resolveBaseLanguage = (lang: Language): BaseLanguage => {
  const base = lang.split("-")[0] as BaseLanguage;
  return translations[base] ? base : "zh";
};

// 語言偏好存儲鍵
const LANGUAGE_STORAGE_KEY = 'app_language_preference';

// 從 localStorage 讀取保存的語言偏好
const getStoredLanguage = (): Language => {
  if (typeof window === 'undefined') return 'zh';

  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) {
      // 驗證存儲的語言是否有效
      const base = stored.split('-')[0] as BaseLanguage;
      if (translations[base]) {
        return stored as Language;
      }
    }
  } catch (error) {
    console.error('Error reading language preference:', error);
  }

  // 如果沒有保存的偏好，嘗試從瀏覽器語言檢測
  if (typeof navigator !== 'undefined' && navigator.language) {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('zh')) return 'zh';
    if (browserLang.startsWith('ja')) return 'ja';
    if (browserLang.startsWith('en')) return 'en';
  }

  return 'zh'; // 默認返回中文
};

// 保存語言偏好到 localStorage
const saveLanguagePreference = (lang: Language) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (error) {
    console.error('Error saving language preference:', error);
  }
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // 從 localStorage 讀取保存的語言偏好，如果沒有則使用默認值
  const [language, setLanguageState] = useState<Language>(() => getStoredLanguage());

  // 包裝 setLanguage 以同時保存到 localStorage
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    saveLanguagePreference(lang);
  };

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
    if (typeof window !== 'undefined') {
      console.warn('[LanguageContext] useLanguage called outside provider, returning default context');
    }
    return defaultLanguageContext;
  }
  return context;
};
