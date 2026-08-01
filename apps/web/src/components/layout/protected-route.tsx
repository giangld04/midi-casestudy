// Protected route guard — renders LoginPage if unauthenticated, children otherwise.
import { useAuth } from "@/hooks/use-auth";
import LoginPage from "@/components/auth/login-page";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const auth = useAuth();

  // Loading — render nothing to avoid flash
  if (auth.loading) return null;

  // Not authenticated — show login
  if (!auth.isAuthenticated) {
    return (
      <LoginPage
        onLogin={auth.login}
        onSignup={auth.signup}
        onGithub={auth.loginWithGithub}
      />
    );
  }

  return <>{children}</>;
}
