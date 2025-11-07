import { useAuthContext } from "@/contexts/AuthContext";

export const useAuth = () => {
  const { user, session, isAnonymous, anonymousId, loading, signOut } = useAuthContext();
  
  return { 
    user, 
    session, 
    isAnonymous, 
    anonymousId,
    loading, 
    signOut 
  };
};
