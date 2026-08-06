"use client"

// ============================================================================
// QUANTIX — Google Maps Platform Health Monitor (admin view)
//
// Super Admin → Platform Settings → Google Maps Health. Runs every pluggable
// health check against the deployed Maps key and renders:
//   • per-check status + DETAILS (Google error code, message, API name, fix, docs)
//   • per-store field verification (lat/lng/radii/address/placeId)
//   • live serviceability sample runs (store → customer → distance → inside/outside)
// ============================================================================

import { useState, useCallback } from "react"
import { RefreshCw, MapPin, Activity, CheckCircle2, XCircle, AlertTriangle, MinusCircle, ExternalLink, ShieldAlert, Wrench, Info } from "lucide-react"
import { PageHeader } from "../shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { authFetch } from "@/lib/admin-fetch"
import { toast } from "sonner"

// ── Types (mirror src/lib/maps-health/types.ts) ─────────────────────────────

type HealthStatus = "healthy" | "warning" | "error" | "skipped"

interface HealthCheckResult {
  id: string
  label: string
  status: HealthStatus
  summary: string
  detail?: string
  googleErrorCode?: string
  googleErrorMessage?: string
  apiName?: string
  suggestedFix?: string
  docsLink?: string
  durationMs?: number
  data?: unknown
}

interface StoreHealthRow {
  storeId: string
  kind: "store" | "laundryStore"
  businessId: string
  businessName: string
  name: string
  fields: {
    latitude: boolean
    longitude: boolean
    deliveryRadius: boolean
    pickupRadius: boolean
    address: boolean
    placeId: boolean
  }
  missing: string[]
  complete: boolean
}

interface ServiceabilitySample {
  businessId: string
  businessName: string
  storeId: string
  storeName: string
  storeLat: number
  storeLng: number
  customerLabel: string
  customerLat: number
  customerLng: number
  distanceKm: number
  radiusKm: number
  inside: boolean
  serviceable: boolean
  reason?: string | null
}

interface MapsHealthReport {
  generatedAt: string
  keyConfigured: boolean
  checks: HealthCheckResult[]
  stores: StoreHealthRow[]
  serviceability: ServiceabilitySample[]
  summary: { total: number; healthy: number; warning: number; error: number; skipped: number }
}

const STATUS_META: Record<HealthStatus, { label: string; dot: string; ring: string }> = {
  healthy: { label: "Healthy", dot: "bg-emerald-500", ring: "border-emerald-200 bg-emerald-50/60" },
  warning: { label: "Warning", dot: "bg-amber-500", ring: "border-amber-200 bg-amber-50/60" },
  error:   { label: "Error",   dot: "bg-red-500",    ring: "border-red-200 bg-red-50/60" },
  skipped: { label: "Skipped", dot: "bg-gray-400",   ring: "border-gray-200 bg-gray-50/60" },
}

const STATUS_ICON = {
  healthy: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  skipped: MinusCircle,
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })
  } catch {
    return iso
  }
}

// ── Per-check status + DETAILS card ─────────────────────────────────────────

function CheckCard({ check }: { check: HealthCheckResult }) {
  const [open, setOpen] = useState(false)
  const meta = STATUS_META[check.status]
  const Icon = STATUS_ICON[check.status]
  const failed = check.status === "error" || check.status === "warning"

  return (
    <Card className={open && failed ? `${meta.ring}` : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.dot}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{check.label}</p>
              <p className="text-[11px] text-muted-foreground">{check.apiName ?? "Google Maps Platform"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={check.status === "error" ? "destructive" : check.status === "warning" ? "outline" : "default"} className="gap-1">
              <Icon className="h-3 w-3" />
              {check.summary}
            </Badge>
            {failed && (
              <button
                onClick={() => setOpen(!open)}
                className="rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {open ? "Hide Details" : "Details"}
              </button>
            )}
          </div>
        </div>

        {failed && open && (
          <div className="mt-3 space-y-2.5 rounded-lg border bg-background/60 p-3">
            <Row label="Google Error Code" value={check.googleErrorCode ?? "—"} mono />
            <Row label="Google Error Message" value={check.googleErrorMessage ?? check.detail ?? "—"} />
            <Row label="API Name" value={check.apiName ?? "—"} />
            <div className="flex items-start gap-2">
              <Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Suggested Fix</p>
                <p className="text-xs">{check.suggestedFix ?? "Review the Google error message above and correct the corresponding configuration in Google Cloud Console."}</p>
              </div>
            </div>
            {check.docsLink && (
              <a
                href={check.docsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                Google Documentation <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-36 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
      <p className={`text-xs flex-1 min-w-0 break-words ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  )
}

// ── Store verification table ────────────────────────────────────────────────

function StoreTable({ stores }: { stores: StoreHealthRow[] }) {
  if (stores.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">No stores configured yet.</p>
  }
  const fieldLabels: Record<keyof StoreHealthRow["fields"], string> = {
    latitude: "Latitude",
    longitude: "Longitude",
    deliveryRadius: "Delivery Radius",
    pickupRadius: "Pickup Radius",
    address: "Address",
    placeId: "Place ID",
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b text-[10px] uppercase tracking-widest text-muted-foreground">
            <th className="py-2 pr-3">Store</th>
            <th className="py-2 pr-3">Business</th>
            <th className="py-2 pr-3">Kind</th>
            {Object.entries(fieldLabels).map(([k, label]) => (
              <th key={k} className="py-2 pr-2">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.storeId} className="border-b border-muted/40">
              <td className="py-2 pr-3 font-medium">{s.name}</td>
              <td className="py-2 pr-3 text-muted-foreground">{s.businessName}</td>
              <td className="py-2 pr-3">
                <Badge variant="outline" className="text-[10px]">{s.kind === "laundryStore" ? "Laundry" : "Store"}</Badge>
              </td>
              {Object.entries(s.fields).map(([k, present]) => (
                <td key={k} className="py-2 pr-2">
                  {present ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <span title={`Missing: ${fieldLabels[k as keyof StoreHealthRow["fields"]]}`}>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {stores.some((s) => !s.complete) && (
        <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          Missing fields shown in amber — these stores cannot be fully serviced or located. Re-pin them with the Store Location picker.
        </p>
      )}
    </div>
  )
}

// ── Serviceability samples ──────────────────────────────────────────────────

function ServiceabilityPanel({ samples }: { samples: ServiceabilitySample[] }) {
  if (samples.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">No active stores with coordinates — nothing to calculate.</p>
  }
  return (
    <div className="space-y-2.5">
      {samples.map((s) => {
        const Inside = () => (
          <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Inside Service Area
          </Badge>
        )
        const Outside = () => (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> Outside Service Area
          </Badge>
        )
        return (
          <div key={`${s.businessId}:${s.storeId}`} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold">{s.storeName} <span className="text-muted-foreground font-normal">· {s.businessName}</span></p>
              {s.inside ? <Inside /> : <Outside />}
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
              <Field label="Store GPS" value={`${s.storeLat.toFixed(4)}, ${s.storeLng.toFixed(4)}`} mono />
              <Field label="Customer" value={s.customerLabel} />
              <Field label="Distance" value={`${s.distanceKm.toFixed(2)} km`} />
              <Field label="Radius" value={`${s.radiusKm.toFixed(1)} km`} />
            </div>
            {!s.serviceable && s.reason && (
              <p className="mt-2 text-[11px] text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> {s.reason}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/80">{label}</p>
      <p className={`text-muted-foreground mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  )
}

// ── Main view ───────────────────────────────────────────────────────────────

export function GoogleMapsHealthView() {
  const [report, setReport] = useState<MapsHealthReport | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/admin/maps-health")
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? "Health check failed")
      setReport(json.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Health check failed")
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Google Maps Health"
        description="Prevent production failures caused by Google Cloud configuration. Runs live diagnostics against the deployed Maps API key."
        icon={MapPin}
        action={
          <Button onClick={run} disabled={loading} className="gap-2 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Running checks…" : "Run Health Check"}
          </Button>
        }
      />

      {report && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          Last run: {fmtTime(report.generatedAt)} · {report.summary.total} checks · {report.summary.healthy} healthy ·{" "}
          {report.summary.warning} warnings · {report.summary.error} errors
          {report.keyConfigured ? " · API key configured" : " · API key MISSING"}
        </div>
      )}

      <div className="mt-4 flex-1 min-h-0 overflow-auto space-y-6 pb-6">
        {!report && !loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <ShieldAlert className="h-10 w-10 opacity-40" />
            <p className="text-sm max-w-sm text-center">
              Run the health check to verify Maps JavaScript API, Places API, Geocoding API, API key, billing,
              referrer, autocomplete, reverse geocoder, store and customer location data, and the serviceability engine.
            </p>
          </div>
        )}

        {loading && !report && (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {report && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Platform Status</CardTitle>
                <CardDescription>Google Maps Platform configuration for the deployed API key.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.checks.map((c) => (
                  <CheckCard key={c.id} check={c} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Store Verification</CardTitle>
                <CardDescription>
                  Every store's Latitude, Longitude, Delivery Radius, Pickup Radius, Address and Place ID. Missing fields appear as warnings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StoreTable stores={report.stores} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Serviceability Sample</CardTitle>
                <CardDescription>
                  Live calculation using the shared engine: Store → Sample Customer → Distance → Inside / Outside.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ServiceabilityPanel samples={report.serviceability} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}