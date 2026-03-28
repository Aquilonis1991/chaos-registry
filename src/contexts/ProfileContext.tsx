import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Profile {
    id: string;
    nickname: string;
    avatar: string;
    tokens: number;
    ad_watch_count: number;
    last_login?: string | null;
    notifications: boolean;
    created_at: string;
    updated_at: string;
    nickname_updated_at?: string | null;
    is_deleted?: boolean;
    deleted_reason?: string | null;
}

interface ProfileContextType {
    profile: Profile | null;
    loading: boolean;
    refreshProfile: () => Promise<void>;
    updateTokensOptimistically: (delta: number) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async (showLoading: boolean = false) => {
        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }

        try {
            // 只在首次加載或明確要求時顯示 loading
            if (showLoading && !profile) {
                setLoading(true);
            }

            // Fetch profile; retry with fewer columns if DB is missing optional fields (42703).
            const baseCols =
                'id, nickname, avatar, tokens, ad_watch_count, last_login, notifications, created_at, updated_at';
            const selectVariants = [
                `${baseCols}, nickname_updated_at, is_deleted, deleted_reason`,
                `${baseCols}, is_deleted, deleted_reason`,
                baseCols,
            ];

            let data: Profile | null = null;
            let fetchError: { code?: string; message?: string } | null = null;

            for (const sel of selectVariants) {
                const res = await supabase.from('profiles').select(sel).eq('id', user.id).single();
                if (!res.error && res.data) {
                    const row = res.data as Record<string, unknown>;
                    data = {
                        ...(row as unknown as Profile),
                        nickname_updated_at:
                            (row.nickname_updated_at as string | null | undefined) ?? null,
                        is_deleted: Boolean(row.is_deleted),
                        deleted_reason: (row.deleted_reason as string | null | undefined) ?? null,
                    };
                    fetchError = null;
                    break;
                }
                fetchError = res.error;
                if (res.error?.code !== '42703') break;
            }

            if (fetchError) throw fetchError;

            if (data?.is_deleted) {
                toast.error('帳號已被刪除，請重新註冊或聯繫客服');
                setProfile(null);
                await supabase.auth.signOut();
                return;
            }

            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [user]);

    // Initial fetch and Realtime subscription
    useEffect(() => {
        if (!user) {
            setProfile(null);
            setLoading(false);
            return;
        }

        // 首次加載
        fetchProfile(true);

        // Set up realtime subscription
        const channel = supabase
            .channel('profile-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                },
                (payload) => {
                    // 實時訂閱自動更新 profile，包括代幣數量
                    console.log('[ProfileContext] Realtime update received:', payload.new);
                    const newProfile = payload.new as Profile;
                    setProfile(newProfile);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchProfile]);

    // Revalidate on window focus
    useEffect(() => {
        const handleFocus = () => {
            if (user) {
                // Silent refresh
                fetchProfile(false);
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [user, fetchProfile]);

    // 樂觀更新代幣數量
    const updateTokensOptimistically = useCallback((delta: number) => {
        setProfile((currentProfile) => {
            if (currentProfile) {
                const newTokens = Math.max(0, (currentProfile.tokens || 0) + delta);
                return {
                    ...currentProfile,
                    tokens: newTokens
                };
            }
            return currentProfile;
        });
    }, []);

    // Public refresh function
    const refreshProfile = useCallback(async () => {
        await fetchProfile(false);
    }, [fetchProfile]);

    return (
        <ProfileContext.Provider value={{ profile, loading, refreshProfile, updateTokensOptimistically }}>
            {children}
        </ProfileContext.Provider>
    );
};

export const useProfile = () => {
    const context = useContext(ProfileContext);
    if (context === undefined) {
        throw new Error('useProfile must be used within a ProfileProvider');
    }
    return context;
};
