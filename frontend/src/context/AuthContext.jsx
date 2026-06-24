/**
 * AgroInsight - Auth Context
 * ============================
 * Wraps the JWT-based session: current user, login/register/logout actions,
 * and loading state while the initial session is being verified against
 * GET /api/auth/me on app boot.
 */

import { useCallback, useEffect, useState } from "react";
import * as authApi from "../api/auth";
import { isAuthenticated, onAuthChange } from "../api/client";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!isAuthenticated()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const currentUser = await authApi.fetchCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: verify session once on mount
    refreshUser();
    // Keep user state in sync if tokens are cleared elsewhere (e.g. a 401
    // that exhausts refresh attempts inside the axios interceptor).
    const unsubscribe = onAuthChange(({ accessToken }) => {
      if (!accessToken) setUser(null);
    });
    return unsubscribe;
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const updateUserInPlace = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        updateUserInPlace,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
