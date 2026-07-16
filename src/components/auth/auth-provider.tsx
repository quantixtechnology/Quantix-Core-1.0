// ============================================================================
// Quantix Technology — Auth Provider Component
// Initializes auth store from localStorage, sets up token refresh interval,
// handles token expiry gracefully, and gates the app behind authentication
// ============================================================================

"use client";

import React, { useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useCustomerAuthStore } from "@/stores/customer-auth-store";
import { useAdminStore, type ViewMode } from "@/stores/admin-store";
import { setBusinessContext } from "@/lib/api-client";
import { LoginPage } from "@/components/auth/login-page";
import { Loader2 } from "lucide-react";
import type { Role } from "@/lib/types";
import { getProductCodeForHost } from "@/lib/product-hosts";

const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in";
// True when the app is served on a product workspace subdomain (commerce.*, …).
// There, the workspace bootstrap in page.tsx owns viewMode (it activates the
// selected business), so the role-based default must not override it.
function isOnProductHost(): boolean {
  if (typeof window === "undefined") return false;
  return !!getProductCodeForHost(window.location.hostname.split(":")[0], STOREFRONT_BASE);
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** How often to refresh the access token (20 minutes) */
const TOKEN_REFRESH_INTERVAL_MS = 20 * 60 * 1000;

// ============================================================================
// ROLE → VIEW MODE MAPPING
// ============================================================================

function getViewModeForRole(role: Role): ViewMode {
  switch (role) {
    case "QUANTIX_SUPER_ADMIN":
    case "QUANTIX_SALES_TEAM":
      return "super_admin";
    case "CLIENT_OWNER":
    case "STORE_MANAGER":
      return "business_owner";
    case "CUSTOMER":
      return "customer";
    case "DELIVERY_STAFF":
      return "delivery_partner";
    default:
      return "super_admin";
  }
}

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
    _isHydrated,
    refreshToken,
    refreshAuthToken,
    clearSession,
    user,
    currentBusinessId,
  } = useAuthStore();

  const { setViewMode, setCurrentBusinessId } = useAdminStore();

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const prevAuthStateRef = useRef(isAuthenticated);
  const hasSyncedRef = useRef(false);

  // ─── Initialize auth stores from localStorage ───────────────────────
  // Admin session (this app) + the isolated Customer session (website / app),
  // hydrated together before any child reads either store. The customer store
  // runs its own one-time legacy-namespace migration; Admin is unaffected.
  useEffect(() => {
    // Customer first: it runs the one-time legacy-namespace migration (adopting a
    // CUSTOMER session out of quantix_auth_* into quantix_customer_*) BEFORE the
    // Admin store reads storage, so a customer session never even momentarily
    // populates the Admin store on a storefront origin. Admin sessions (non-
    // CUSTOMER role) are never migrated, so this is a no-op for admins.
    useCustomerAuthStore.getState().initialize();
    initialize();
  }, [initialize]);

  // ─── Sync auth state with admin store on login/hydration ────────────
  useEffect(() => {
    if (isAuthenticated && user && !hasSyncedRef.current) {
      hasSyncedRef.current = true;

      // On a product workspace host the selected business is activated by the
      // page.tsx bootstrap; setting the role-based viewMode here would replace
      // it with the Platform workspace (the reported bug). Skip it there.
      if (!isOnProductHost()) {
        const viewMode = getViewModeForRole(user.role as Role);
        setViewMode(viewMode);
      }

      if (currentBusinessId) {
        setCurrentBusinessId(currentBusinessId);
        setBusinessContext(currentBusinessId);
      }
    }

    if (!isAuthenticated) {
      hasSyncedRef.current = false;
    }
  }, [
    isAuthenticated,
    user,
    currentBusinessId,
    setViewMode,
    setCurrentBusinessId,
  ]);

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
      if (
        document.visibilityState === "visible" &&
        isAuthenticated &&
        refreshToken
      ) {
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
      // Another tab signed out (the Admin token was removed) → clear THIS tab's
      // local session only. Never call the server logout here: the other tab
      // already invalidated the refresh token, and re-invalidating from an
      // automatic cross-tab signal must never touch a still-valid session.
      if (e.key === "quantix_auth_token" && !e.newValue && isAuthenticated) {
        clearSession();
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
  }, [isAuthenticated, clearSession, initialize, onSessionExpired]);

  // ─── Not yet hydrated — show loading ────────────────────────────────
  if (!_isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">
            Loading Quantix Core...
          </p>
        </div>
      </div>
    );
  }

  // ─── Not authenticated — show login page (skip for storefront subdomains) ────
  // Storefront subdomains (arbazchicken.quantixtechnology.in) have their own
  // CustomerAuth flow inside CustomerLayout. Never show the admin LoginPage there.
  if (!isAuthenticated) {
    const hostname = window.location.hostname.split(":")[0]
    const storefrontBase = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"
    const isStorefrontSubdomain =
      hostname.endsWith(`.${storefrontBase}`) &&
      !["www", "app", "admin", "api", "mail"].includes(hostname.split(".")[0])

    console.log("[AuthProvider] unauthenticated | hostname=", hostname, "| isStorefront=", isStorefrontSubdomain)

    if (!isStorefrontSubdomain) {
      return <LoginPage />
    }
    // Storefront: fall through and render children (AppRouter → CustomerLayout)
  }

  // ─── Authenticated or storefront subdomain — render the app ─────────
  return <>{children}</>;
}
