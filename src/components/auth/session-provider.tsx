"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { SessionUser, Role } from "@/lib/types";
import { useAdminStore } from "@/stores/admin-store";

// ============================================================================
// TYPES
// ============================================================================

interface SessionContextValue {
  /** Current authenticated user, or null if not logged in */
  user: SessionUser | null;
  /** Whether the session is being loaded/restored */
  isLoading: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Login with email/password */
  login: (email: string, password: string) => Promise<void>;
  /** Login with OTP */
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  /** Logout and clear session */
  logout: () => void;
  /** Refresh the current user data */
  refreshUser: () => Promise<void>;
  /** Get the auth token */
  getToken: () => string | null;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

const TOKEN_KEY = "quantix_auth_token";
const REFRESH_TOKEN_KEY = "quantix_refresh_token";
const TOKEN_EXPIRY_KEY = "quantix_token_expiry";
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh 5 minutes before expiry

function storeToken(token: string, expiresIn?: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresIn) {
    const expiry = Date.now() + expiresIn * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
  }
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function isTokenExpiringSoon(): boolean {
  if (typeof window === "undefined") return false;
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return false;
  return Date.now() > Number(expiry) - TOKEN_REFRESH_THRESHOLD;
}

function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem("quantix_business_id");
}

// ============================================================================
// SESSION PROVIDER
// ============================================================================

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const {
    setCustomerLoggedIn,
    setCustomerName,
    setDeliveryLoggedIn,
    setDeliveryPartnerName,
  } = useAdminStore();

  // Fetch current user from the /auth/me endpoint
  const fetchCurrentUser = useCallback(async (): Promise<SessionUser | null> => {
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/core/auth/me", {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearTokens();
          setUser(null);
        }
        return null;
      }

      const data = await response.json();
      const sessionUser = (data.data as SessionUser) || null;
      return sessionUser;
    } catch {
      return null;
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      setIsLoading(false);

      // Sync with admin store
      if (currentUser) {
        if (currentUser.role === "CUSTOMER") {
          setCustomerLoggedIn(true);
          setCustomerName(currentUser.name);
        }
        if (currentUser.role === "DELIVERY_STAFF") {
          setDeliveryLoggedIn(true);
          setDeliveryPartnerName(currentUser.name);
        }
      }
    };

    initSession();
  }, [fetchCurrentUser, setCustomerLoggedIn, setCustomerName, setDeliveryLoggedIn, setDeliveryPartnerName]);

  // Auto-refresh token before expiry
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isTokenExpiringSoon() && user) {
        await fetchCurrentUser();
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [user, fetchCurrentUser]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch("/api/core/auth/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || "Login failed");
    }

    // Store token if returned
    if (data.data?.token) {
      storeToken(data.data.token, data.data.expiresIn);
    }

    const sessionUser = (data.data?.user as SessionUser) || (data.data as SessionUser) || null;
    setUser(sessionUser);

    // Sync with admin store
    if (sessionUser) {
      if (sessionUser.role === "CUSTOMER") {
        setCustomerLoggedIn(true);
        setCustomerName(sessionUser.name);
      }
      if (sessionUser.role === "DELIVERY_STAFF") {
        setDeliveryLoggedIn(true);
        setDeliveryPartnerName(sessionUser.name);
      }
    }
  }, [setCustomerLoggedIn, setCustomerName, setDeliveryLoggedIn, setDeliveryPartnerName]);

  const loginWithOtp = useCallback(async (phone: string, otp: string) => {
    const response = await fetch("/api/core/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
      credentials: "include",
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || "OTP verification failed");
    }

    if (data.data?.token) {
      storeToken(data.data.token, data.data.expiresIn);
    }

    const sessionUser = (data.data?.user as SessionUser) || (data.data as SessionUser) || null;
    setUser(sessionUser);

    if (sessionUser) {
      if (sessionUser.role === "CUSTOMER") {
        setCustomerLoggedIn(true);
        setCustomerName(sessionUser.name);
      }
      if (sessionUser.role === "DELIVERY_STAFF") {
        setDeliveryLoggedIn(true);
        setDeliveryPartnerName(sessionUser.name);
      }
    }
  }, [setCustomerLoggedIn, setCustomerName, setDeliveryLoggedIn, setDeliveryPartnerName]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setCustomerLoggedIn(false);
    setCustomerName("");
    setDeliveryLoggedIn(false);
    setDeliveryPartnerName("");
  }, [setCustomerLoggedIn, setCustomerName, setDeliveryLoggedIn, setDeliveryPartnerName]);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
  }, [fetchCurrentUser]);

  const getToken = useCallback(() => getStoredToken(), []);

  const value: SessionContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginWithOtp,
    logout,
    refreshUser,
    getToken,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Access the current session context
 */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

/**
 * Check if the current user has a specific role
 */
export function useHasRole(role: Role | Role[]): boolean {
  const { user } = useSession();
  if (!user) return false;
  if (Array.isArray(role)) return role.includes(user.role);
  return user.role === role;
}

/**
 * Check if the current user is a platform admin
 */
export function useIsPlatformAdmin(): boolean {
  const { user } = useSession();
  return user?.isPlatformAdmin ?? false;
}
