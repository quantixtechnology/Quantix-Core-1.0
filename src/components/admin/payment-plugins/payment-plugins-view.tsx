"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CreditCard, Shield, Globe, Zap, AlertCircle, CheckCircle2,
  Building2, Settings2, ToggleLeft, ToggleRight, Eye, EyeOff,
  ChevronRight, Info, Lock, Unlock, Search,
} from "lucide-react"
import { showSuccess, showError } from "@/lib/toast-utils"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAuthHeaders } from "@/lib/admin-fetch"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GatewayPlugin {
  id: string
  gateway: string
  displayName: string
  description: string | null
  isGloballyEnabled: boolean
  supportedMethods: string   // JSON string
  webhookPath: string | null
  docsUrl: string | null
  createdAt: string
  businessAccess?: BusinessAccess[]
}

interface BusinessAccess {
  id: string
  businessId: string
  pluginId: string
  isAssigned: boolean
  canConfigure: boolean
  isActive: boolean
  config: string
  notes: string | null
  assignedAt: string | null
  business?: { id: string; name: string; businessType: string }
}

interface Business {
  id: string
  name: string
  businessType: string
  status: string
}

// ---------------------------------------------------------------------------
// Gateway colour + icon map
// ---------------------------------------------------------------------------
const GATEWAY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  razorpay:  { color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  phonepe:   { color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  paytm:     { color: "text-sky-700",    bg: "bg-sky-50",    border: "border-sky-200" },
  bharatpe:  { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  pinelabs:  { color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  cashfree:  { color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200" },
  payu:      { color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  stripe:    { color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  hdfc:      { color: "text-cyan-700",   bg: "bg-cyan-50",   border: "border-cyan-200" },
  ccavenue:  { color: "text-rose-700",   bg: "bg-rose-50",   border: "border-rose-200" },
}

function gatewayStyle(gw: string) {
  return GATEWAY_STYLE[gw] || { color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200" }
}

function parseMethods(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

function methodBadgeColor(m: string) {
  const map: Record<string, string> = {
    UPI: "bg-purple-100 text-purple-700", CARD: "bg-blue-100 text-blue-700",
    NETBANKING: "bg-sky-100 text-sky-700", WALLET: "bg-amber-100 text-amber-700",
    QR: "bg-emerald-100 text-emerald-700", EMI: "bg-rose-100 text-rose-700",
    CONTACTLESS: "bg-cyan-100 text-cyan-700", ACH: "bg-slate-100 text-slate-700",
  }
  return map[m] || "bg-slate-100 text-slate-700"
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ToggleSwitch({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg transition duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function PaymentPluginsView() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterEnabled, setFilterEnabled] = useState<"all" | "enabled" | "disabled">("all")

  // Selected plugin for business assignment sheet
  const [assignPlugin, setAssignPlugin] = useState<GatewayPlugin | null>(null)
  const [assignSheetOpen, setAssignSheetOpen] = useState(false)
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null)
  const [businessSearch, setBusinessSearch] = useState("")

  // Config inspection dialog (read-only view of a business's config)
  const [configDialog, setConfigDialog] = useState<{ plugin: GatewayPlugin; access: BusinessAccess } | null>(null)

  // ── Fetch plugins ────────────────────────────────────────────────────────
  const { data: pluginsData, isLoading } = useQuery<GatewayPlugin[]>({
    queryKey: ["platform-payment-plugins"],
    queryFn: async () => {
      const res  = await fetch("/api/admin/payment-plugins", { headers: getAuthHeaders() })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      return data.data
    },
    refetchInterval: 60_000,
  })

  // ── Fetch businesses ─────────────────────────────────────────────────────
  const { data: businessData } = useQuery<Business[]>({
    queryKey: ["admin-businesses-list"],
    queryFn: async () => {
      const res  = await fetch("/api/admin/businesses?limit=200", { headers: getAuthHeaders() })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      return (data.data || []) as Business[]
    },
  })

  // ── Mutations ────────────────────────────────────────────────────────────
  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res  = await fetch("/api/admin/payment-plugins", {
        method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["platform-payment-plugins"] })
      showSuccess(data.message || "Updated")
    },
    onError: (e) => showError(e instanceof Error ? e.message : "Operation failed"),
  })

  // ── Derived data ─────────────────────────────────────────────────────────
  const plugins = pluginsData || []

  const filteredPlugins = useMemo(() => plugins.filter((p) => {
    const matchSearch = !searchQuery || p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || p.gateway.includes(searchQuery.toLowerCase())
    const matchFilter = filterEnabled === "all" || (filterEnabled === "enabled" ? p.isGloballyEnabled : !p.isGloballyEnabled)
    return matchSearch && matchFilter
  }), [plugins, searchQuery, filterEnabled])

  const filteredBusinesses = useMemo(() => {
    const all = businessData || []
    if (!businessSearch) return all
    return all.filter((b) => b.name.toLowerCase().includes(businessSearch.toLowerCase()))
  }, [businessData, businessSearch])

  const enabledCount  = plugins.filter((p) => p.isGloballyEnabled).length
  const assignedTotal = plugins.reduce((sum, p) => sum + (p.businessAccess?.filter((a) => a.isAssigned).length || 0), 0)

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleGlobal = (plugin: GatewayPlugin) => {
    patchMutation.mutate({ action: "toggle_global", pluginId: plugin.id, value: !plugin.isGloballyEnabled })
  }

  const toggleAssign = (pluginId: string, businessId: string, current: boolean) => {
    patchMutation.mutate({ action: "assign_business", pluginId, businessId, value: !current })
  }

  const toggleCanConfigure = (pluginId: string, businessId: string, current: boolean) => {
    patchMutation.mutate({ action: "set_can_configure", pluginId, businessId, value: !current })
  }

  const getAccessForBusiness = (plugin: GatewayPlugin, bizId: string): BusinessAccess | undefined =>
    plugin.businessAccess?.find((a) => a.businessId === bizId)

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Payment Plugin Control
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Globally enable payment gateways and control which businesses can access and configure each plugin.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="gap-1.5 text-xs">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            {enabledCount} enabled
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Building2 className="h-3 w-3 text-blue-600" />
            {assignedTotal} assignments
          </Badge>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 p-3">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-0.5">
          <p className="font-semibold">Super Admin Governance</p>
          <p>Only globally-enabled plugins appear in business POS terminals. You control whether a business can configure credentials themselves or must use admin-provided keys.</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Gateways",    value: plugins.length,  color: "text-slate-600",   icon: Globe },
          { label: "Globally Enabled",  value: enabledCount,    color: "text-emerald-600", icon: CheckCircle2 },
          { label: "Business Assigns",  value: assignedTotal,   color: "text-blue-600",    icon: Building2 },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-xs" placeholder="Search gateways…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        {(["all", "enabled", "disabled"] as const).map((f) => (
          <Button key={f} size="sm" variant={filterEnabled === f ? "default" : "outline"} className="h-7 text-[11px] px-2.5 capitalize" onClick={() => setFilterEnabled(f)}>
            {f}
          </Button>
        ))}
      </div>

      {/* Plugin grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredPlugins.map((plugin) => {
            const style   = gatewayStyle(plugin.gateway)
            const methods = parseMethods(plugin.supportedMethods)
            const assignCount = plugin.businessAccess?.filter((a) => a.isAssigned).length || 0
            const canConfigCount = plugin.businessAccess?.filter((a) => a.canConfigure).length || 0

            return (
              <Card
                key={plugin.id}
                className={`shadow-none border transition-all ${plugin.isGloballyEnabled ? `${style.border}` : "border-muted opacity-70"}`}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.border} border`}>
                        <CreditCard className={`h-4.5 w-4.5 ${style.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{plugin.displayName}</CardTitle>
                        <code className="text-[10px] text-muted-foreground">{plugin.gateway}</code>
                      </div>
                    </div>
                    {/* Global toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-medium ${plugin.isGloballyEnabled ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {plugin.isGloballyEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <ToggleSwitch
                        checked={plugin.isGloballyEnabled}
                        onChange={() => toggleGlobal(plugin)}
                        disabled={patchMutation.isPending}
                      />
                    </div>
                  </div>
                  <CardDescription className="text-[11px] mt-1.5 leading-snug">{plugin.description}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {/* Methods */}
                  <div className="flex flex-wrap gap-1">
                    {methods.map((m) => (
                      <span key={m} className={`inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-medium ${methodBadgeColor(m)}`}>{m}</span>
                    ))}
                  </div>

                  {/* Assignment summary */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{assignCount} businesses</span>
                    <span className="flex items-center gap-1"><Unlock className="h-3 w-3" />{canConfigCount} can configure</span>
                    {plugin.webhookPath && <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" />Webhook</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-[11px] flex-1"
                      disabled={!plugin.isGloballyEnabled}
                      onClick={() => { setAssignPlugin(plugin); setAssignSheetOpen(true); setBusinessSearch("") }}
                    >
                      <Building2 className="h-3 w-3" />
                      Manage Businesses
                    </Button>
                    {plugin.docsUrl && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                        <a href={plugin.docsUrl} target="_blank" rel="noopener noreferrer"><Globe className="h-3.5 w-3.5 text-muted-foreground" /></a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Business Assignment Sheet ──────────────────────────────────────── */}
      <Sheet open={assignSheetOpen} onOpenChange={(o) => { setAssignSheetOpen(o); if (!o) setAssignPlugin(null) }}>
        <SheetContent className="w-full sm:w-[560px] sm:max-w-[560px] p-0 flex flex-col">
          {assignPlugin && (() => {
            const style = gatewayStyle(assignPlugin.gateway)
            return (
              <>
                <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
                  <SheetDescription className="sr-only">Manage business access for {assignPlugin.displayName}</SheetDescription>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.border} border`}>
                      <CreditCard className={`h-4.5 w-4.5 ${style.color}`} />
                    </div>
                    <div>
                      <SheetTitle className="text-base">{assignPlugin.displayName}</SheetTitle>
                      <p className="text-[11px] text-muted-foreground">Assign gateway access and configure permissions per business</p>
                    </div>
                  </div>

                  {/* Permission legend */}
                  <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />Assigned = gateway visible in POS</span>
                    <span className="flex items-center gap-1"><Unlock className="h-3 w-3" />Can Configure = business can edit credentials</span>
                  </div>
                </SheetHeader>

                <div className="px-5 pt-4 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="pl-8 h-8 text-xs" placeholder="Search businesses…" value={businessSearch} onChange={(e) => setBusinessSearch(e.target.value)} />
                  </div>
                </div>

                <ScrollArea className="flex-1 min-h-0 px-5 pt-3 pb-5">
                  {filteredBusinesses.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">No businesses found</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredBusinesses.map((biz) => {
                        const access = getAccessForBusiness(assignPlugin, biz.id)
                        const isAssigned    = access?.isAssigned    || false
                        const canConfigure  = access?.canConfigure  || false

                        return (
                          <div key={biz.id} className={`rounded-lg border p-3 transition-colors ${isAssigned ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{biz.name}</p>
                                <p className="text-[10px] text-muted-foreground capitalize">{biz.businessType?.toLowerCase().replace(/_/g, " ")} · {biz.status}</p>
                              </div>
                              {/* Assigned toggle */}
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">Assigned</span>
                                  <ToggleSwitch
                                    checked={isAssigned}
                                    onChange={() => toggleAssign(assignPlugin.id, biz.id, isAssigned)}
                                    disabled={patchMutation.isPending}
                                  />
                                </div>
                                {isAssigned && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground">Can Configure</span>
                                    <ToggleSwitch
                                      checked={canConfigure}
                                      onChange={() => toggleCanConfigure(assignPlugin.id, biz.id, canConfigure)}
                                      disabled={patchMutation.isPending}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Permission explanation */}
                            {isAssigned && (
                              <div className={`mt-2 flex items-center gap-1.5 text-[10px] rounded px-2 py-1 ${canConfigure ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                {canConfigure
                                  ? <><Unlock className="h-3 w-3 shrink-0" />Business owner can add API keys and configure this gateway.</>
                                  : <><Lock className="h-3 w-3 shrink-0" />Business can use this gateway but cannot edit credentials.</>
                                }
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* Config inspection dialog */}
      {configDialog && (
        <Dialog open onOpenChange={() => setConfigDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Settings2 className="h-4 w-4" />
                {configDialog.plugin.displayName} — Config Snapshot
              </DialogTitle>
              <DialogDescription className="text-xs">
                Stored credentials for {configDialog.access.business?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="bg-slate-50 rounded-lg p-3 font-mono text-xs max-h-60 overflow-auto border">
              {JSON.stringify(JSON.parse(configDialog.access.config || "{}"), null, 2)}
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => setConfigDialog(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
