// ============================================================================
// Quantix Technology — Auth Provider Component
// Initializes auth store from localStorage, sets up token refresh interval,
// and handles token expiry gracefully
// ============================================================================

"use client";

import React, { useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";

// ============================================================================
// CONFIGURATION
// ============================================================================

/** How often to refresh the access token (20 minutes) */
const TOKEN_REFRESH_INTERVAL_MS = 20 * 60 * 1000;

/** How early before token expiry to trigger a refresh (5 minutes) */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ============================================================================
// AUTH PROVIDER COMPONENT
// ============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
  /** Optional callback when token refresh fails and user is logged out */
  onSessionExpired?: () => void;
  /** Optional callback when user logs in */
  onLogin?: () => void;
  /** Optional callback when user logs out */
  onLogout?: () => void;
}

export function AuthProvider({
  children,
  onSessionExpired,
  onLogin,
  onLogout,
}: AuthProviderProps) {
  const {
    initialize,
    isAuthenticated,
    refreshToken,
    refreshAuthToken,
    logout,
    user,
  } = useAuthStore();

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInitializedRef = useRef(false);
  const prevAuthStateRef = useRef(isAuthenticated);

  // ─── Initialize auth store from localStorage ────────────────────────
  useEffect(() => {
    if (!isInitializedRef.current) {
      initialize();
      isInitializedRef.current = true;
    }
  }, [initialize]);

  // ─── Track auth state changes ───────────────────────────────────────
  useEffect(() => {
    if (prevAuthStateRef.current !== isAuthenticated) {
      if (isAuthenticated) {
        onLogin?.();
      } else {
        onLogout?.();
      }
      prevAuthStateRef.current = isAuthenticated;
    }
  }, [isAuthenticated, onLogin, onLogout]);

  // ─── Token refresh handler ──────────────────────────────────────────
  const handleTokenRefresh = useCallback(async () => {
    if (!refreshToken || !isAuthenticated) return;

    try {
      await refreshAuthToken();
    } catch {
      // If refresh fails, the auth store will handle logout
      onSessionExpired?.();
    }
  }, [refreshToken, isAuthenticated, refreshAuthToken, onSessionExpired]);

  // ─── Set up periodic token refresh ──────────────────────────────────
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // Only set up refresh if authenticated
    if (isAuthenticated && refreshToken) {
      // Do an initial refresh on mount
      handleTokenRefresh();

      // Set up interval for periodic refresh
      refreshIntervalRef.current = setInterval(() => {
        handleTokenRefresh();
      }, TOKEN_REFRESH_INTERVAL_MS);
    }

    // Cleanup on unmount or when auth state changes
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, refreshToken, handleTokenRefresh]);

  // ─── Handle page visibility change (refresh token when tab becomes active) ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isAuthenticated && refreshToken) {
        handleTokenRefresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, refreshToken, handleTokenRefresh]);

  // ─── Handle storage events (sync across tabs) ──────────────────────
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // If another tab logged out, this tab should also log out
      if (e.key === "quantix_auth_token" && !e.newValue && isAuthenticated) {
        logout();
        onSessionExpired?.();
      }

      // If another tab logged in, re-initialize
      if (e.key === "quantix_auth_token" && e.newValue && !isAuthenticated) {
        initialize();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [isAuthenticated, logout, initialize, onSessionExpired]);

  return <>{children}</>;
}
