"use client"

// ============================================================================
// Laundry workspace bootstrap.
//
// Turns the fragile "render the shell immediately" flow into an explicit,
// ordered sequence so a bad state can NEVER leave a blank white page:
//
//   1. Auth        — wait for localStorage hydration + server-side /me validation
//                    (a dead/expired session is dropped here → LoginPage, never blank)
//   2. Tenant/Biz  — the workspace must have a business id to operate on
//   3. RBAC        — validate the business is real & this session can see it via
//                    getRuntimeAuth() (/api/laundry/rbac/me). Invalid business or
//                    an unauthorized session → friendly "Unable to load this
//                    workspace" recovery screen instead of an empty shell.
//   4. Navigation  — loads inside the shell (LaundrySidebar / navigation API),
//                    each view has its own loading/error fallback.
//   5. Render      — only now is <LaundryLayout> mounted.
//
// The page.tsx caller wraps this in an <ErrorBoundary> so any thrown render
// error also lands on a recovery screen, never a blank tree.
//
// Presentation only + workspace-scoped state cleanup. No auth/RBAC/navigation
// architecture is changed; the existing AuthProvider/AuthGuard/RuntimeAuth
// providers remain the single source of truth.
// ============================================================================

import { useEffect, useState } from "react"
import { Loader2, AlertTriangle, LogIn, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { clearRuntimeAuthCache } from "@/components/auth/runtime-auth-provider"

type BootstrapStatus = "loading" | "ready" | "failed"

function WorkspaceLoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm text-muted-foreground">Loading Laundry Workspace…</p>
      </div>
    </div>
  )
}

function WorkspaceUnavailableScreen({
  onReturnToLogin,
  onRetry,
}: {
  onReturnToLogin: () => void
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-center px-4 gap-6">
      <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <div className="space-y-2 max-w-md">
        <h1 className="text-xl font-bold text-white">Unable to load this workspace</h1>
        <p className="text-sm text-white/40">
          We couldn&apos;t open the Laundry workspace. Your session may have expired, or
          this workspace is unavailable for your account.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={onReturnToLogin} variant="default" className="gap-2">
          <LogIn className="h-4 w-4" /> Return to Login
        </Button>
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try Again
        </Button>
      </div>
    </div>
  )
}

export function LaundryWorkspaceBootstrap({
  businessId,
  children,
}: {
  businessId?: string
  children: React.ReactNode
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const token = useAuthStore((s) => s.token)
  const _isHydrated = useAuthStore((s) => s._isHydrated)
  const _isSynced = useAuthStore((s) => s._isSynced)
  const resetWorkspaceState = useAdminStore((s) => s.resetWorkspaceState)

  const [status, setStatus] = useState<BootstrapStatus>("loading")
  const [attempt, setAttempt] = useState(0)

  // Ordered init: Auth → Tenant/Business → RBAC → Render. Navigation + view
  // loads happen inside the shell once the shell is allowed to render.
  useEffect(() => {
    let cancelled = false

    async function run() {
      setStatus("loading")

      // 1. Auth — wait for hydration + server-side validation to settle.
      if (!_isHydrated || !_isSynced || !isAuthenticated) return

      // 2. Tenant/Business — a workspace always needs a business to operate on.
      if (!businessId) {
        setStatus("failed")
        return
      }

      // 3. RBAC — confirms the business is real AND this session may use it.
      //    The token is attached explicitly: this runs OUTSIDE LaundryLayout,
      //    so the LaundryAuthBridge (fetch patch) is not mounted yet.
      //    Non-success ⇔ invalid business or unauthorized/expired session.
      try {
        const res = await fetch(
          `/api/laundry/rbac/me?businessId=${encodeURIComponent(businessId)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        )
        if (cancelled) return
        if (res.status === 401) {
          // Session is no longer valid on this workspace — recovery screen.
          setStatus("failed")
          return
        }
        const json = await res.json().catch(() => null)
        if (cancelled) return
        setStatus(json?.success ? "ready" : "failed")
      } catch {
        if (!cancelled) setStatus("failed")
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [_isHydrated, _isSynced, isAuthenticated, token, businessId, attempt])

  // Explicit user action (never an automatic path): end the workspace session
  // locally and land on the Login page. Mirrors the header logout cleanup.
  const handleReturnToLogin = () => {
    try {
      useAuthStore.getState().clearSession()
    } catch {
      /* no-op */
    }
    try {
      resetWorkspaceState()
    } catch {
      /* no-op */
    }
    try {
      clearRuntimeAuthCache()
    } catch {
      /* no-op */
    }
    if (typeof window !== "undefined") window.location.href = "/"
  }

  if (status === "loading") return <WorkspaceLoadingScreen />
  if (status === "failed") {
    return (
      <WorkspaceUnavailableScreen
        onReturnToLogin={handleReturnToLogin}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    )
  }

  // 4/5. Navigation + Render — the shell mounts and loads its own nav config.
  return <>{children}</>
}
