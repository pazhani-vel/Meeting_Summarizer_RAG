import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { configureAuth, loginUser, registerUser, getMe, logoutUser } from "../services/api";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // -- token management helpers ------------------------------------------

  const setAccess = useCallback((token) => {
    setAccessToken(token);
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem("refreshToken");
  }, []);

  // Wire up api.js interceptors so they can read the current access token
  // and call clearAuth when a refresh attempt also fails.
  useEffect(() => {
    configureAuth(
      () => accessToken,
      setAccess,
      clearAuth,
    );
  }, [accessToken, setAccess, clearAuth]);

  // -- on mount: exchange stored refresh token for a fresh access token ---

  useEffect(() => {
    const storedRefresh = localStorage.getItem("refreshToken");
    if (!storedRefresh) {
      setLoading(false);
      return;
    }

    // Attempt to refresh; the interceptor will handle the actual call
    getMe()
      .then((data) => {
        if (data.status === "success" && data.user) {
          setUser(data.user);
        } else {
          clearAuth();
        }
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -- public actions ----------------------------------------------------

  const login = useCallback(
    async (email, password) => {
      const data = await loginUser(email, password);
      if (data.status === "success") {
        // Store refresh token (access token stays in memory)
        if (data.refresh_token) {
          localStorage.setItem("refreshToken", data.refresh_token);
        }
        setAccess(data.access_token);
        setUser(data.user);
        return data;
      }
      throw new Error(data.message || "Login failed");
    },
    [setAccess],
  );

  const register = useCallback(
    async (email, password) => {
      const data = await registerUser(email, password);
      if (data.status === "success") {
        // Registration logs the user straight in
        if (data.refresh_token) {
          localStorage.setItem("refreshToken", data.refresh_token);
        }
        setAccess(data.access_token);
        setUser(data.user);
        return data;
      }
      throw new Error(data.message || "Registration failed");
    },
    [setAccess],
  );

  const logout = useCallback(async () => {
    try {
      if (accessToken) {
        await logoutUser(accessToken);
      }
    } catch {
      // Best-effort — server may already be unreachable
    }
    clearAuth();
  }, [accessToken, clearAuth]);

  // -- expose context ----------------------------------------------------

  const value = {
    user,
    accessToken,
    loading,
    login,
    register,
    logout,
    isAuthenticated: Boolean(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
