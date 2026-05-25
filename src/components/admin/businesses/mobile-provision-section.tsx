"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"
import {
  Smartphone, RefreshCw, ExternalLink, Package, RotateCcw,
  Loader2, Flame, Palette, GitBranch,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

type DeploymentStatus = "PENDING" | "BUILDING" | "DEPLOYING" | "LIVE" | "FAILED" | "MAINTENANCE"

interface AppStatus {
  type: string
  status: DeploymentStatus
  repoUrl: string | null
  apkUrl: string | null
  aabUrl: string | null
  brandingStatus: string | null
  firebaseStatus: string | null
  error: string | null
  deployedAt: string | null
}

interface MobileStatusResponse {
  success: boolean
  slug: string
  serviceReachable: boolean
  liveStatus: string | null
  apps: Record<string, AppStatus>
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DeploymentStatus,
  { label: string; color: string; bg: string }
> = {
  PENDING: { label: "Pending", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  BUILDING: { label: "Building", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  DEPLOYING: { label: "Deploying", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  LIVE: { label: "Live", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  FAILED: { label: "Failed", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  MAINTENANCE: { label: "Maintenance", color: "text-gray-700", bg: "bg-gray-50 border-gray-200" },
}

function StatusPill({ status }: { status: DeploymentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  )
}

const APP_LABELS: Record<string, string> = {
  CUSTOMER_APP: "Customer",
  DELIVERY_APP: "Delivery",
  ADMIN_APP: "Admin",
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MobileProvisionSectionProps {
  businessId: string
  slug: string
  /** Initial deployments from the business list API (types CUSTOMER_APP etc.) */
  initialDeployments: Array<{ id: string; type: string; status: string }>
}

export function MobileProvisionSection({
  businessId,
  slug,
  initialDeployments,
}: MobileProvisionSectionProps) {
  const [status, setStatus] = useState<MobileStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const mobileDeployments = initialDeployments.filter((d) =>
    ["CUSTOMER_APP", "DELIVERY_APP", "ADMIN_APP"].includes(d.type),
  )
  const isProvisioned = mobileDeployments.length > 0
  const hasFailed =
    mobileDeployments.length > 0 &&
    mobileDeployments.every((d) => d.status === "FAILED")

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/core/businesses/${businessId}/mobile/status`,
        { headers: getAuthHeaders() },
      )
      if (res.ok) {
        const data: MobileStatusResponse = await res.json()
        setStatus(data)
      }
    } catch {
      // service unreachable — fail silently, keep showing DB state
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    if (isProvisioned) void fetchStatus()
  }, [isProvisioned, fetchStatus])

  async function trigger(retry: boolean) {
    setActionLoading(true)
    try {
      const res = await fetch(
        `/api/core/businesses/${businessId}/mobile/provision`,
        {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(retry ? { retry: true } : {}),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Unknown error")
      toast.success(retry ? "Provisioning retry triggered" : "Mobile provisioning started")
      await fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to trigger provisioning")
    } finally {
      setActionLoading(false)
    }
  }

  const apps = status?.apps ?? {}
  const appOrder: Array<"CUSTOMER_APP" | "DELIVERY_APP" | "ADMIN_APP"> = [
    "CUSTOMER_APP",
    "DELIVERY_APP",
    "ADMIN_APP",
  ]

  return (
    <>
      <Separator />
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Smartphone className="size-3" /> Mobile Apps
          </h4>
          <div className="flex items-center gap-1.5">
            {isProvisioned && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => void fetchStatus()}
                disabled={loading}
                title="Refresh status"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            )}
            {hasFailed && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 text-red-600 border-red-200"
                onClick={() => void trigger(true)}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                Retry
              </Button>
            )}
            {!isProvisioned && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => void trigger(false)}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="size-3 animate-spin" /> : <Smartphone className="size-3" />}
                Provision
              </Button>
            )}
          </div>
        </div>

        {/* Service unreachable warning */}
        {status && !status.serviceReachable && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
            Provision service unreachable — showing last known state
          </div>
        )}

        {/* Not yet provisioned */}
        {!isProvisioned && (
          <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Mobile apps not yet provisioned for this business.
          </div>
        )}

        {/* App status cards */}
        {isProvisioned && (
          <div className="space-y-2">
            {appOrder.map((appType) => {
              const app = apps[appType]
              const fallback = mobileDeployments.find((d) => d.type === appType)
              const displayStatus = (app?.status ?? fallback?.status ?? "PENDING") as DeploymentStatus

              return (
                <div key={appType} className="rounded-lg border p-2.5 space-y-2">
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{APP_LABELS[appType] ?? appType}</span>
                    <StatusPill status={displayStatus} />
                  </div>

                  {app && (
                    <>
                      {/* Status row */}
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Palette className="size-2.5" />
                          <span>Branding:</span>
                          <span className={app.brandingStatus === "DONE" ? "text-green-600 font-medium" : "text-yellow-600"}>
                            {app.brandingStatus ?? "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Flame className="size-2.5" />
                          <span>Firebase:</span>
                          <span className={app.firebaseStatus === "CONFIGURED" ? "text-green-600 font-medium" : "text-yellow-600"}>
                            {app.firebaseStatus ?? "STUB"}
                          </span>
                        </div>
                      </div>

                      {/* Links */}
                      <div className="flex flex-wrap gap-2">
                        {app.repoUrl && (
                          <a
                            href={app.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                          >
                            <GitBranch className="size-2.5" /> Repo
                            <ExternalLink className="size-2.5" />
                          </a>
                        )}
                        {app.apkUrl && (
                          <a
                            href={app.apkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-green-600 hover:underline"
                          >
                            <Package className="size-2.5" /> APK
                            <ExternalLink className="size-2.5" />
                          </a>
                        )}
                        {app.aabUrl && (
                          <a
                            href={app.aabUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-purple-600 hover:underline"
                          >
                            <Package className="size-2.5" /> AAB
                            <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </div>

                      {/* Error */}
                      {app.error && (
                        <div className="rounded bg-red-50 border border-red-100 px-2 py-1 text-[10px] text-red-600 font-mono break-all">
                          {app.error}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
