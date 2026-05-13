// ============================================================================
// Quantix Technology — Auth Guard Component
// Protects routes based on authentication and role requirements
// ============================================================================

"use client";

import React, { useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useAdminStore, type ViewMode } from "@/stores/admin-store";
import type { Role } from "@/lib/types";
import { Loader2 } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface AuthGuardProps {
  children: React.ReactNode;
  /** Required roles - user must have one of these roles to access */
  allowedRoles?: Role[];
  /** View mode this guard protects — redirects to correct login if not authed */
  viewMode?: ViewMode;
  /** Fallback component to show while checking auth */
  loadingFallback?: React.ReactNode;
  /** Component to show when user is not authenticated (instead of redirect) */
  unauthorizedFallback?: React.ReactNode;
  /** Whether to show the unauthorized fallback instead of redirecting */
  showFallback?: boolean;
}

// ============================================================================
// MAPPING: ViewMode → default login route behavior
// ============================================================================

// ============================================================================
// INITIALIZED TRACKER (module-level to persist across renders)
// ============================================================================

const initializedGuards = new Set<string>();
let guardIdCounter = 0;

// ============================================================================
// AUTH GUARD COMPONENT
// ============================================================================

export function AuthGuard({
  children,
  allowedRoles,
  viewMode,
  loadingFallback,
  unauthorizedFallback,
  showFallback = false,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading, currentRole, user, initialize, refreshAuthToken } =
    useAuthStore();
  const { viewMode: currentViewMode, setCustomerPage, setDeliveryPage } =
    useAdminStore();

  // Stable unique ID for this guard instance
  const guardId = useMemo(() => {
    guardIdCounter++;
    return `guard-${guardIdCounter}`;
  }, []);

  const hasInitialized = initializedGuards.has(guardId);

  // Initialize auth store on mount — only the side effect (no setState)
  useEffect(() => {
    if (!initializedGuards.has(guardId)) {
      initialize();
      initializedGuards.add(guardId);
    }
  }, [initialize, guardId]);

  // Refresh token when authenticated
  useEffect(() => {
    if (hasInitialized && isAuthenticated) {
      refreshAuthToken().catch(() => {});
    }
  }, [hasInitialized, isAuthenticated, refreshAuthToken]);

  // ─── Loading state ──────────────────────────────────────────────────
  if (isLoading || !hasInitialized) {
    if (loadingFallback) return <>{loadingFallback}</>;
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // ─── Not authenticated ──────────────────────────────────────────────
  if (!isAuthenticated || !user) {
    if (showFallback && unauthorizedFallback) {
      return <>{unauthorizedFallback}</>;
    }

    // Redirect to appropriate login based on view mode
    const targetViewMode = viewMode || currentViewMode;

    if (targetViewMode === "customer") {
      setCustomerPage("auth");
    } else if (targetViewMode === "delivery_partner") {
      setDeliveryPage("login");
    }
    // For super_admin and business_owner, we stay on the current view
    // The UI layer handles showing the login form

    if (unauthorizedFallback) return <>{unauthorizedFallback}</>;

    // Return null — the parent component should handle unauthenticated state
    return null;
  }

  // ─── Role check ─────────────────────────────────────────────────────
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = currentRole || user.role;
    if (!allowedRoles.includes(userRole)) {
      if (showFallback && unauthorizedFallback) {
        return <>{unauthorizedFallback}</>;
      }

      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-3 p-8">
            <div className="text-4xl">🔒</div>
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">
              You don&apos;t have permission to access this page.
            </p>
            <p className="text-sm text-muted-foreground">
              Required role: {allowedRoles.join(" or ")}
            </p>
          </div>
        </div>
      );
    }
  }

  // ─── Authenticated and authorized ───────────────────────────────────
  return <>{children}</>;
}

// ============================================================================
// CONVENIENCE PRESETS
// ============================================================================

/** Guard for platform admin routes (Super Admin + Sales Team) */
export function PlatformAdminGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["QUANTIX_SUPER_ADMIN", "QUANTIX_SALES_TEAM"]} viewMode="super_admin">
      {children}
    </AuthGuard>
  );
}

/** Guard for business owner routes */
export function BusinessOwnerGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["CLIENT_OWNER"]} viewMode="business_owner">
      {children}
    </AuthGuard>
  );
}

/** Guard for store manager routes */
export function StoreManagerGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["STORE_MANAGER", "CLIENT_OWNER"]} viewMode="business_owner">
      {children}
    </AuthGuard>
  );
}

/** Guard for customer routes */
export function CustomerGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["CUSTOMER"]} viewMode="customer">
      {children}
    </AuthGuard>
  );
}

/** Guard for delivery staff routes */
export function DeliveryStaffGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["DELIVERY_STAFF"]} viewMode="delivery_partner">
      {children}
    </AuthGuard>
  );
}
