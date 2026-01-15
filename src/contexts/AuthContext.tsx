import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAnonymous: boolean;
  anonymousId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInAnonymously: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 生成匿名用戶ID
const generateAnonymousId = (): string => {
  return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 從localStorage獲取或創建匿名ID
const getOrCreateAnonymousId = (): string => {
  const stored = localStorage.getItem('anonymous_id');
  if (stored) {
    return stored;
  }
  const newId = generateAnonymousId();
  localStorage.setItem('anonymous_id', newId);
  return newId;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 安全超時機制：如果 Supabase 響應過慢，強制結束載入狀態
  useEffect(() => {
    console.log('[AuthProvider] Mounting and starting authentication check...');

    // 使用 ref 來追蹤組件是否已卸載，避免在已卸載的組件上設置狀態
    let isMounted = true;

    // 安全超時機制（修復閉包問題：直接設置狀態，不檢查 loading）
    const timeoutTimer = setTimeout(() => {
      if (isMounted) {
        console.warn('[AuthProvider] Session check timed out, forcing loading to false');
        setLoading(false);
      }
    }, 2000); // 縮短為 2秒

    // 檢查是否有現有session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return; // 如果組件已卸載，不執行狀態更新
      
      console.log('[AuthProvider] getSession completed, session exists:', !!session);
      clearTimeout(timeoutTimer); // 成功獲取後清除計時器
      if (session) {
        setSession(session);
        setUser(session.user);
        setIsAnonymous(false);
        setAnonymousId(null);
      } else {
        // 沒有session，檢查是否有匿名ID
        const anonId = getOrCreateAnonymousId();
        setAnonymousId(anonId);
        setIsAnonymous(true);
        setUser(null);
        setSession(null);
      }
      setLoading(false);
    }).catch(err => {
      if (!isMounted) return; // 如果組件已卸載，不執行狀態更新
      
      console.error('[AuthProvider] Get session error:', err);
      clearTimeout(timeoutTimer);
      setLoading(false);
    });

    // 監聽認證狀態變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return; // 如果組件已卸載，不執行狀態更新
        
        if (session) {
          setSession(session);
          setUser(session.user);
          setIsAnonymous(false);
          setAnonymousId(null);
          // 清除匿名ID
          localStorage.removeItem('anonymous_id');

          // 更新最後登入時間（僅在登入時，不是每次狀態變化）
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            try {
              // 異步更新，不阻塞 UI
              supabase
                .from('profiles')
                .update({
                  last_login: new Date().toISOString(),
                  last_login_date: new Date().toISOString().split('T')[0]
                })
                .eq('id', session.user.id)
                .then(({ error }) => {
                  if (error) {
                    console.warn('[AuthContext] Failed to update last_login:', error);
                  }
                });
            } catch (error) {
              console.warn('[AuthContext] Error updating last_login:', error);
            }
          }
        } else {
          // 登出時保持匿名狀態
          const anonId = getOrCreateAnonymousId();
          setAnonymousId(anonId);
          setIsAnonymous(true);
          setUser(null);
          setSession(null);
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false; // 標記組件已卸載
      subscription.unsubscribe();
      clearTimeout(timeoutTimer);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // 登出後自動轉為匿名模式
    const anonId = getOrCreateAnonymousId();
    setAnonymousId(anonId);
    setIsAnonymous(true);
    setUser(null);
    setSession(null);
  };

  const signInAnonymously = () => {
    const anonId = getOrCreateAnonymousId();
    setAnonymousId(anonId);
    setIsAnonymous(true);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAnonymous,
        anonymousId,
        loading,
        signOut,
        signInAnonymously,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
