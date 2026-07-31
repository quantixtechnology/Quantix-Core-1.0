// ============================================================================
// Quantix Technology — AuthGuard
// Gate for protected layouts. Never renders children (sidebar, header,
// dashboard, data…) until the auth session has been fully restored:
//
//   1. localStorage hydration complete          (_isHydrated)
//   2. access token validated server-side via /me (_isBootstrapped)
//   3. role / permissions / businesses loaded   (_isSynced)
//
// During initialization only a full-screen loader is shown. If the token is
// invalid/expired the auth store clears the local session and AuthProvider
// redirects to Login — protected content is never flashed.
//
// `requireAuth` defaults to true (protected layout). Set it to false only for
// public storefront layouts (Customer/Delivery shell) where unauthenticated
// guests must still render — they only need the bootstrap to be complete so
// an existing session can never flash stale protected UI.
// ============================================================================

"use client";

import React from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2 } from "lucide-react";

export function AuthGuard({
  children,
  requireAuth = true,
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
}) {
  const _isHydrated = useAuthStore((s) => s._isHydrated);
  const _isBootstrapped = useAuthStore((s) => s._isBootstrapped);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const ready = _isHydrated && _isBootstrapped;
  const canRender = requireAuth ? ready && isAuthenticated : ready;

  if (!canRender) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
