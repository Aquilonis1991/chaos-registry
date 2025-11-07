import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="text-primary-foreground text-xl">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <Navigate to="/auth" replace />;
};

export default Index;
