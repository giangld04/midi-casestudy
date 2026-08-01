// Auth hook — wraps Better Auth's useSession and exposes convenience methods.
import { useCallback } from "react";
import { authClient } from "@/lib/auth-client";

export function useAuth() {
  const session = authClient.useSession();
  const data = session.data;

  const login = useCallback(async (email: string, password: string) => {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) return { error: result.error.message ?? "Login failed" };
    return {};
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const result = await authClient.signUp.email({ email, password, name });
    if (result.error) return { error: result.error.message ?? "Sign-up failed" };
    return {};
  }, []);

  const logout = useCallback(async () => {
    await authClient.signOut();
  }, []);

  const loginWithGithub = useCallback(async () => {
    // callbackURL: where GitHub sends the user back AFTER a successful login. Without it,
    // Better Auth redirects to its baseURL (the API domain) whose "/" has no route →
    // "Cannot GET /". Point it at the web app's own origin (a trusted origin).
    await authClient.signIn.social({
      provider: "github",
      callbackURL: window.location.origin,
      errorCallbackURL: window.location.origin,
    });
  }, []);

  return {
    user: data?.user ?? null,
    session: data?.session ?? null,
    isAuthenticated: !!data?.user,
    loading: session.isPending,
    login,
    signup,
    logout,
    loginWithGithub,
  };
}

export type UseAuthReturn = ReturnType<typeof useAuth>;
